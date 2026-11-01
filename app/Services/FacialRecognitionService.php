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
        if ($this->usesArcFace()) {
            $profile = $teacher->activeFaceProfile;

            return $profile !== null
                && $profile->is_active
                && ! $profile->migration_required
                && is_array($profile->embedding)
                && count($profile->embedding) >= 32;
        }

        return $teacher->face_registered_at !== null
            && $this->isValidDescriptor($teacher->face_descriptor);
    }

    public function requiresMigration(Teacher $teacher): bool
    {
        if (! $this->usesArcFace() || $this->hasValidEnrollment($teacher)) {
            return false;
        }

        if ($teacher->faceProfiles()->where('migration_required', true)->exists()) {
            return true;
        }

        return $teacher->face_registered_at !== null
            && $this->isValidDescriptor($teacher->face_descriptor);
    }

    public function engine(): string
    {
        $override = config('face.engine');
        if (in_array($override, ['face_api', 'arcface'], true)) {
            return $override;
        }

        $setting = (string) SystemSetting::getValue('face_recognition_engine', 'face_api');

        return in_array($setting, ['face_api', 'arcface'], true) ? $setting : 'face_api';
    }

    public function usesArcFace(): bool
    {
        return $this->engine() === 'arcface';
    }

    public function arcfaceThreshold(): float
    {
        return (float) SystemSetting::getValue('arcface_match_threshold', 0.40);
    }

    public function livenessEnabled(): bool
    {
        return (bool) SystemSetting::getValue('face_liveness_enabled', true);
    }

    public function qualityThreshold(): float
    {
        return (float) SystemSetting::getValue('face_quality_threshold', 0.55);
    }

    public static function staffMessage(string $code): string
    {
        return match ($code) {
            'NO_FACE' => "No face detected.\nPlease position your face inside the guide.",
            'MULTIPLE_FACES' => "Multiple faces detected.\nPlease ensure only you are visible.",
            'FACE_TOO_SMALL' => "Move closer to the camera.",
            'FACE_TOO_DARK' => "The lighting is too low.\nMove to a brighter location.",
            'FACE_TOO_BLURRY' => "The image is not clear enough.\nHold still and try again.",
            'FACE_POOR_POSITION' => "Look directly at the camera and center your face in the guide.",
            'LIVENESS_FAILED' => "A live face could not be verified.\nPlease try again.",
            'LIVENESS_UNAVAILABLE' => "Face verification is temporarily unavailable.\nPlease try again shortly.",
            'PRESENTATION_ATTACK' => "A possible photograph or screen presentation was detected.",
            'INCONSISTENT_SAMPLES' => "The enrollment samples were not consistent.\nHold still and try again.",
            'NOT_ENROLLED', 'MIGRATION_REQUIRED' => "Face verification is not available for your account.\nPlease contact an administrator.",
            'NOT_MATCHED' => "Face not recognized.\nPlease try again.",
            default => "Face verification is temporarily unavailable.\nPlease try again shortly.",
        };
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
     * Server-side ArcFace check. The browser score is never an input.
     *
     * @param  list<string>  $frames
     * @return array<string, mixed>
     */
    public function verifyArcFaceCapture(Teacher $teacher, string $image, array $frames): array
    {
        $threshold = $this->arcfaceThreshold();
        $teacher = $teacher->fresh() ?? $teacher;

        if (! $this->hasValidEnrollment($teacher)) {
            return [
                'matched' => false,
                'score' => null,
                'threshold' => $threshold,
                'reason' => $this->requiresMigration($teacher) ? 'migration_required' : 'not_enrolled',
                'status' => $this->requiresMigration($teacher) ? 'MIGRATION_REQUIRED' : 'NOT_ENROLLED',
            ];
        }

        $profile = $teacher->activeFaceProfile;
        $response = app(FaceServiceClient::class)->verify(
            $image,
            $frames,
            $profile->embedding,
            $threshold,
            $this->qualityThreshold(),
            $this->livenessEnabled(),
        );

        $status = (string) ($response['status'] ?? 'SERVICE_UNAVAILABLE');
        $score = isset($response['match_score']) ? (float) $response['match_score'] : null;
        $livenessPassed = ($response['liveness'] ?? null) === true;
        $qualityScore = isset($response['quality_score']) ? (float) $response['quality_score'] : null;
        $qualityPassed = $qualityScore === null || $qualityScore >= $this->qualityThreshold();
        $identityMatched = $status === 'READY'
            && $score !== null
            && $score >= $threshold
            && $qualityPassed;

        if ($this->livenessEnabled() && ! $livenessPassed) {
            $matched = false;
            $status = in_array($status, ['LIVENESS_FAILED', 'LIVENESS_UNAVAILABLE', 'PRESENTATION_ATTACK'], true)
                ? $status
                : 'LIVENESS_FAILED';
        } elseif (! $identityMatched) {
            $matched = false;
            $status = $status === 'READY' ? 'NOT_MATCHED' : $status;
        } else {
            $matched = true;
            $status = 'READY';
        }

        if ($matched && $profile) {
            $profile->forceFill(['last_verified_at' => now()])->save();
        }

        return [
            'matched' => $matched,
            'score' => $score,
            'threshold' => $threshold,
            'reason' => $matched ? null : ($status === 'NOT_MATCHED' ? 'face_not_recognized' : strtolower($status)),
            'status' => $status,
            'liveness_passed' => $livenessPassed,
            'quality_score' => $qualityScore,
            'processing_time_ms' => isset($response['processing_time_ms']) ? (int) $response['processing_time_ms'] : null,
            'model' => $response['embedding_model'] ?? 'w600k_r50',
        ];
    }

    /**
     * @param  array{payload: array<string, mixed>, score: float}|null  $verified
     * @return array<string, mixed>
     */
    public function verifiedAttendanceAttributes(?array $verified): array
    {
        $payload = $verified['payload'] ?? null;
        $score = $verified['score'] ?? ($payload['score'] ?? null);

        return [
            'face_verified' => $payload !== null,
            'face_match_score' => $score,
            'face_verified_at' => $payload ? now() : null,
            'face_liveness_passed' => $payload['liveness_passed'] ?? null,
            'face_quality_score' => $payload['quality_score'] ?? null,
            'face_model' => $payload['model'] ?? null,
            'face_verification_processing_ms' => $payload['processing_time_ms'] ?? null,
        ];
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

        if ($this->usesArcFace()) {
            return [
                'face_verification_token' => ['required', 'string'],
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

        if ($this->usesArcFace()) {
            $payload = $this->consumeVerificationToken($token, $teacher, $timetableId);
            if ($payload === null || ($payload['engine'] ?? '') !== 'arcface') {
                return null;
            }

            return [
                'payload' => $payload,
                'score' => (float) ($payload['score'] ?? 0),
            ];
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

    /**
     * @param  array<string, mixed>  $context
     */
    public function issueVerificationToken(Teacher $teacher, int $timetableId, float $score, array $context = []): string
    {
        $engine = (string) ($context['engine'] ?? 'face_api');
        $threshold = (float) ($context['threshold'] ?? ($engine === 'arcface' ? $this->arcfaceThreshold() : $this->threshold()));

        if ($engine === 'arcface') {
            if ($score < $threshold || ($this->livenessEnabled() && empty($context['liveness_passed']))) {
                throw new InvalidArgumentException('Cannot issue a verification token for a non-matching face.');
            }
        } elseif ($score > $this->threshold()) {
            throw new InvalidArgumentException('Cannot issue a verification token for a non-matching face.');
        }

        $payload = [
            'nonce' => Str::random(40),
            'teacher_id' => $teacher->id,
            'timetable_id' => $timetableId,
            'score' => $score,
            'threshold' => $threshold,
            'engine' => $engine,
            'liveness_passed' => $context['liveness_passed'] ?? null,
            'quality_score' => $context['quality_score'] ?? null,
            'processing_time_ms' => $context['processing_time_ms'] ?? null,
            'model' => $context['model'] ?? null,
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

        $engine = (string) ($payload['engine'] ?? 'face_api');
        $score = (float) ($payload['score'] ?? ($engine === 'arcface' ? -1 : INF));
        $threshold = (float) ($payload['threshold'] ?? ($engine === 'arcface' ? $this->arcfaceThreshold() : $this->threshold()));
        $scoreRejected = $engine === 'arcface'
            ? $score < $threshold || ($this->livenessEnabled() && empty($payload['liveness_passed']))
            : $score > $this->threshold();

        if (
            (int) ($payload['teacher_id'] ?? 0) !== (int) $teacher->id ||
            (int) ($payload['timetable_id'] ?? 0) !== (int) $timetableId ||
            (int) ($payload['expires_at'] ?? 0) < now()->timestamp ||
            $scoreRejected
        ) {
            return null;
        }

        return $payload;
    }

    /**
     * @param  array<string, mixed>  $context
     */
    public function logAttempt(Teacher $teacher, ?int $timetableId, string $result, ?float $score = null, ?string $failureReason = null, array $context = []): void
    {
        FaceVerificationAttempt::create([
            'teacher_id' => $teacher->id,
            'timetable_id' => $timetableId,
            'score' => $score,
            'result' => $result,
            'failure_reason' => $failureReason,
            'liveness_passed' => $context['liveness_passed'] ?? null,
            'quality_score' => $context['quality_score'] ?? null,
            'processing_time_ms' => $context['processing_time_ms'] ?? null,
            'engine' => $context['engine'] ?? $this->engine(),
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
                'threshold' => $context['threshold'] ?? $this->threshold(),
                'result' => $result,
                'failure_reason' => $failureReason,
                'engine' => $context['engine'] ?? $this->engine(),
                'liveness_passed' => $context['liveness_passed'] ?? null,
                'quality_score' => $context['quality_score'] ?? null,
                'processing_time_ms' => $context['processing_time_ms'] ?? null,
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
