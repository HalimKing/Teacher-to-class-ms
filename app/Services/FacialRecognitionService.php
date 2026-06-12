<?php

namespace App\Services;

use App\Models\FaceVerificationAttempt;
use App\Models\SystemSetting;
use App\Models\Teacher;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use InvalidArgumentException;

class FacialRecognitionService
{
    private const TOKEN_CACHE_PREFIX = 'face_verification_token:';
    private const DESCRIPTOR_LENGTH = 128;

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
        return (float) SystemSetting::getValue('face_match_threshold', 0.6);
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

    public function issueVerificationToken(Teacher $teacher, int $timetableId, float $score): string
    {
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
            (int) ($payload['expires_at'] ?? 0) < now()->timestamp
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
