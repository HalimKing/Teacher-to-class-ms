<?php

namespace App\Services;

use App\Models\FaceVerificationAttempt;
use App\Models\SystemSetting;
use App\Models\Teacher;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class FacialRecognitionService
{
    private const TOKEN_CACHE_PREFIX = 'face_verification_token:';
    private const DESCRIPTOR_LENGTH = 128;
    private const DEFAULT_THRESHOLD = 0.45;

    public function normalizeDescriptor(array $descriptor): array
    {
        if (count($descriptor) !== self::DESCRIPTOR_LENGTH) {
            throw new InvalidArgumentException('Face descriptor must contain 128 numeric values.');
        }

        return array_map(function ($value) {
            if (!is_numeric($value)) {
                throw new InvalidArgumentException('Face descriptor contains a non-numeric value.');
            }

            return (float) $value;
        }, array_values($descriptor));
    }

    public function isValidDescriptor(?array $descriptor): bool
    {
        if ($descriptor === null || count($descriptor) !== self::DESCRIPTOR_LENGTH) {
            return false;
        }

        foreach ($descriptor as $value) {
            if (!is_numeric($value)) {
                return false;
            }
        }

        return true;
    }

    public function hasValidEnrollment(Teacher $teacher): bool
    {
        return $teacher->face_registered_at !== null
            && $this->isValidDescriptor($teacher->face_descriptor);
    }

    public function compareDescriptors(array $storedDescriptor, array $liveDescriptor): float
    {
        $stored = $this->normalizeDescriptor($storedDescriptor);
        $live = $this->normalizeDescriptor($liveDescriptor);

        $sum = 0.0;
        foreach ($stored as $index => $value) {
            $difference = $value - $live[$index];
            $sum += $difference * $difference;
        }

        return sqrt($sum);
    }

    public function threshold(): float
    {
        return (float) SystemSetting::getValue('face_match_threshold', self::DEFAULT_THRESHOLD);
    }

    public function timeoutSeconds(): int
    {
        return (int) SystemSetting::getValue('face_verification_timeout', 120);
    }

    public function isEnabled(): bool
    {
        return (bool) SystemSetting::getValue('facial_recognition_enabled', false);
    }

    public function isEnrollmentRequired(): bool
    {
        return (bool) SystemSetting::getValue('face_enrollment_required', false);
    }

    /**
     * @return array{matched: bool, score: float|null, threshold: float, reason: string|null}
     */
    public function verifyLiveCapture(Teacher $teacher, array $liveDescriptor, ?array $quality = null): array
    {
        $teacher = $teacher->fresh() ?? $teacher;
        $threshold = $this->threshold();

        if (!$this->hasValidEnrollment($teacher)) {
            return [
                'matched' => false,
                'score' => null,
                'threshold' => $threshold,
                'reason' => 'not_enrolled',
            ];
        }

        if ($quality !== null) {
            $this->assertValidCaptureQuality($quality);
        }

        $score = $this->compareDescriptors($teacher->face_descriptor, $liveDescriptor);

        return [
            'matched' => $score <= $threshold,
            'score' => $score,
            'threshold' => $threshold,
            'reason' => $score <= $threshold ? null : 'face_not_recognized',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function attendanceValidationRules(bool $facialRecognitionEnabled, bool $requireQuality = false): array
    {
        if (!$facialRecognitionEnabled) {
            return [
                'face_verification_token' => ['nullable', 'string'],
                'face_descriptor' => ['nullable', 'array'],
                'quality' => ['nullable', 'array'],
            ];
        }

        $rules = [
            'face_verification_token' => ['required', 'string'],
            'face_descriptor' => ['required', 'array', 'size:128'],
            'face_descriptor.*' => ['required', 'numeric'],
        ];

        if ($requireQuality) {
            $rules = array_merge($rules, [
                'quality.detection_confidence' => ['required', 'numeric', 'min:0.7', 'max:1'],
                'quality.face_width' => ['required', 'numeric', 'min:80'],
                'quality.face_height' => ['required', 'numeric', 'min:80'],
                'quality.frame_count' => ['required', 'integer', 'min:3'],
                'quality.descriptor_variance' => ['required', 'numeric', 'max:0.18'],
            ]);
        } else {
            $rules['quality'] = ['nullable', 'array'];
        }

        return $rules;
    }

    /**
     * @return array{payload: array<string, mixed>, score: float}|null
     */
    public function resolveVerifiedAttendanceFace(
        Teacher $teacher,
        int $timetableId,
        string $token,
        array $liveDescriptor,
        ?array $quality = null,
    ): ?array {
        if (!$this->isEnabled() || !$this->hasValidEnrollment($teacher)) {
            return null;
        }

        $match = $this->verifyLiveCapture($teacher, $liveDescriptor, $quality);
        if (!$match['matched']) {
            return null;
        }

        $payload = $this->consumeVerificationToken($token, $teacher, $timetableId);
        if ($payload === null) {
            return null;
        }

        if (($payload['score'] ?? INF) > $this->threshold()) {
            return null;
        }

        return [
            'payload' => $payload,
            'score' => $match['score'],
        ];
    }

    public function issueVerificationToken(Teacher $teacher, int $timetableId, float $score): string
    {
        if ($score > $this->threshold()) {
            throw new InvalidArgumentException('Cannot issue a verification token for a non-matching face.');
        }

        $payload = [
            'nonce' => Str::random(40),
            'teacher_id' => $teacher->id,
            'timetable_id' => $timetableId,
            'score' => $score,
            'expires_at' => now()->addSeconds($this->timeoutSeconds())->timestamp,
        ];

        $encodedPayload = $this->base64UrlEncode(json_encode($payload, JSON_THROW_ON_ERROR));
        $signature = hash_hmac('sha256', $encodedPayload, config('app.key'));
        $token = "{$encodedPayload}.{$signature}";

        Cache::put($this->cacheKey($signature), $payload, $this->timeoutSeconds());

        return $token;
    }

    public function consumeVerificationToken(string $token, Teacher $teacher, int $timetableId): ?array
    {
        [$encodedPayload, $signature] = array_pad(explode('.', $token, 2), 2, null);

        if (!$encodedPayload || !$signature) {
            return null;
        }

        $expectedSignature = hash_hmac('sha256', $encodedPayload, config('app.key'));
        if (!hash_equals($expectedSignature, $signature)) {
            return null;
        }

        $payload = Cache::pull($this->cacheKey($signature));
        if (!$payload) {
            return null;
        }

        if (
            (int) ($payload['teacher_id'] ?? 0) !== (int) $teacher->id ||
            (int) ($payload['timetable_id'] ?? 0) !== (int) $timetableId ||
            (int) ($payload['expires_at'] ?? 0) < now()->timestamp ||
            (float) ($payload['score'] ?? INF) > $this->threshold()
        ) {
            return null;
        }

        return $payload;
    }

    public function logAttempt(Teacher $teacher, ?int $timetableId, string $result, ?float $score = null, ?string $failureReason = null): void
    {
        FaceVerificationAttempt::create([
            'teacher_id' => $teacher->id,
            'timetable_id' => $timetableId,
            'score' => $score,
            'result' => $result,
            'failure_reason' => $failureReason,
            'ip_address' => request()?->ip(),
            'user_agent' => request()?->userAgent(),
        ]);

        $activityLog = app(ActivityLogService::class);
        $isSuccess = in_array($result, ['passed', 'success'], true);

        $activityLog->logAttendance(
            eventType: $isSuccess ? 'face_verification_success' : 'face_verification_failed',
            description: $isSuccess
                ? 'Face verification succeeded'
                : ('Face verification failed' . ($failureReason ? ': ' . $failureReason : '')),
            status: $isSuccess ? ActivityLogService::STATUS_SUCCESS : ActivityLogService::STATUS_FAILED,
            actor: $activityLog->actorFromTeacher($teacher),
            metadata: [
                'teacher_id' => $teacher->id,
                'timetable_id' => $timetableId,
                'score' => $score,
                'threshold' => $this->threshold(),
                'result' => $result,
                'failure_reason' => $failureReason,
            ],
            securityFlag: !$isSuccess,
        );
    }

    /**
     * @param  array<string, mixed>  $quality
     */
    public function assertValidCaptureQuality(array $quality): void
    {
        $validator = Validator::make(['quality' => $quality], [
            'quality.detection_confidence' => ['required', 'numeric', 'min:0.7', 'max:1'],
            'quality.face_width' => ['required', 'numeric', 'min:80'],
            'quality.face_height' => ['required', 'numeric', 'min:80'],
            'quality.frame_count' => ['required', 'integer', 'min:3'],
            'quality.descriptor_variance' => ['required', 'numeric', 'max:0.18'],
        ]);

        if ($validator->fails()) {
            throw ValidationException::withMessages($validator->errors()->toArray());
        }
    }

    private function cacheKey(string $signature): string
    {
        return self::TOKEN_CACHE_PREFIX . $signature;
    }

    private function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
