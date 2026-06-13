<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class ActivityLogService
{
    public const STATUS_SUCCESS = 'success';
    public const STATUS_FAILED = 'failed';

    public const CATEGORY_AUTHENTICATION = 'authentication';
    public const CATEGORY_ATTENDANCE = 'attendance';
    public const CATEGORY_USER_MANAGEMENT = 'user_management';
    public const CATEGORY_TIMETABLE = 'timetable';
    public const CATEGORY_SYSTEM_SETTINGS = 'system_settings';
    public const CATEGORY_SECURITY = 'security';

    public function log(
        string $eventType,
        string $category,
        string $description,
        string $status = self::STATUS_SUCCESS,
        ?array $actor = null,
        ?Request $request = null,
        array $metadata = [],
        bool $securityFlag = false,
    ): ?ActivityLog {
        try {
            $request = $request ?? request();
            $actor = $actor ?? $this->resolveActor($request);

            return ActivityLog::query()->create([
                'event_type' => $eventType,
                'event_category' => $category,
                'description' => $description,
                'status' => $status,
                'actor_type' => $actor['type'] ?? null,
                'actor_id' => $actor['id'] ?? null,
                'actor_name' => $actor['name'] ?? 'System',
                'actor_role' => $actor['role'] ?? 'system',
                'ip_address' => $request?->ip(),
                'user_agent' => $request?->userAgent(),
                'route' => $request?->path(),
                'method' => $request?->method(),
                'metadata' => empty($metadata) ? null : $metadata,
                'is_security_flag' => $securityFlag,
            ]);
        } catch (\Throwable $exception) {
            Log::warning('Failed to write activity log: ' . $exception->getMessage(), [
                'event_type' => $eventType,
                'category' => $category,
            ]);

            return null;
        }
    }

    public function logAuthentication(
        string $eventType,
        string $description,
        string $status = self::STATUS_SUCCESS,
        ?array $actor = null,
        array $metadata = [],
        bool $securityFlag = false,
    ): ?ActivityLog {
        return $this->log(
            eventType: $eventType,
            category: self::CATEGORY_AUTHENTICATION,
            description: $description,
            status: $status,
            actor: $actor,
            metadata: $metadata,
            securityFlag: $securityFlag || $status === self::STATUS_FAILED,
        );
    }

    public function logAttendance(
        string $eventType,
        string $description,
        string $status = self::STATUS_SUCCESS,
        ?array $actor = null,
        array $metadata = [],
        bool $securityFlag = false,
    ): ?ActivityLog {
        return $this->log(
            eventType: $eventType,
            category: self::CATEGORY_ATTENDANCE,
            description: $description,
            status: $status,
            actor: $actor,
            metadata: $metadata,
            securityFlag: $securityFlag,
        );
    }

    public function logUserManagement(string $eventType, string $description, array $metadata = []): ?ActivityLog
    {
        return $this->log(
            eventType: $eventType,
            category: self::CATEGORY_USER_MANAGEMENT,
            description: $description,
            metadata: $metadata,
        );
    }

    public function logTimetable(string $eventType, string $description, array $metadata = []): ?ActivityLog
    {
        return $this->log(
            eventType: $eventType,
            category: self::CATEGORY_TIMETABLE,
            description: $description,
            metadata: $metadata,
        );
    }

    public function logSystemSettings(string $eventType, string $description, array $metadata = []): ?ActivityLog
    {
        return $this->log(
            eventType: $eventType,
            category: self::CATEGORY_SYSTEM_SETTINGS,
            description: $description,
            metadata: $metadata,
        );
    }

    public function logSecurityEvent(string $eventType, string $description, array $metadata = [], string $status = self::STATUS_FAILED): ?ActivityLog
    {
        return $this->log(
            eventType: $eventType,
            category: self::CATEGORY_SECURITY,
            description: $description,
            status: $status,
            metadata: $metadata,
            securityFlag: true,
        );
    }

    public function resolveActor(?Request $request = null): array
    {
        if (Auth::guard('web')->check()) {
            /** @var User $user */
            $user = Auth::guard('web')->user();

            return [
                'type' => User::class,
                'id' => $user->id,
                'name' => $user->name,
                'role' => 'admin',
            ];
        }

        if (Auth::guard('teacher')->check()) {
            /** @var Teacher $teacher */
            $teacher = Auth::guard('teacher')->user();

            return [
                'type' => Teacher::class,
                'id' => $teacher->id,
                'name' => trim("{$teacher->first_name} {$teacher->last_name}"),
                'role' => $teacher->staff_type === Teacher::STAFF_TYPE_ADMINISTRATOR ? 'administrator' : 'teacher',
            ];
        }

        return [
            'type' => null,
            'id' => null,
            'name' => 'Guest',
            'role' => 'guest',
        ];
    }

    public function actorFromTeacher(?Teacher $teacher): array
    {
        if (!$teacher) {
            return $this->resolveActor();
        }

        return [
            'type' => Teacher::class,
            'id' => $teacher->id,
            'name' => trim("{$teacher->first_name} {$teacher->last_name}"),
            'role' => $teacher->staff_type === Teacher::STAFF_TYPE_ADMINISTRATOR ? 'administrator' : 'teacher',
        ];
    }

    public function mapAttendanceAction(string $action, array $payload = []): array
    {
        $reason = $payload['reason'] ?? null;

        return match ($action) {
            'check_in' => [
                'event_type' => 'attendance_check_in',
                'description' => 'Attendance check-in recorded',
                'status' => self::STATUS_SUCCESS,
            ],
            'check_out' => [
                'event_type' => 'attendance_check_out',
                'description' => 'Attendance check-out recorded',
                'status' => self::STATUS_SUCCESS,
            ],
            'attempt_failed' => [
                'event_type' => $this->resolveFailedAttendanceEventType($payload),
                'description' => $reason ?: 'Attendance attempt failed',
                'status' => self::STATUS_FAILED,
                'security_flag' => $this->isSuspiciousAttendanceFailure($payload),
            ],
            default => [
                'event_type' => 'attendance_' . $action,
                'description' => 'Attendance activity: ' . $action,
                'status' => self::STATUS_SUCCESS,
            ],
        };
    }

    private function resolveFailedAttendanceEventType(array $payload): string
    {
        $reason = strtolower((string) ($payload['reason'] ?? ''));

        if (str_contains($reason, 'face')) {
            return 'face_verification_failed';
        }

        if (str_contains($reason, 'location') || str_contains($reason, 'gps') || str_contains($reason, 'geo')) {
            return 'geolocation_verification_failed';
        }

        return 'attendance_attempt_failed';
    }

    private function isSuspiciousAttendanceFailure(array $payload): bool
    {
        $reason = strtolower((string) ($payload['reason'] ?? ''));

        return str_contains($reason, 'face') || str_contains($reason, 'location') || str_contains($reason, 'gps');
    }
}
