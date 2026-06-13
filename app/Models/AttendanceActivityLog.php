<?php

namespace App\Models;

use App\Services\ActivityLogService;
use Illuminate\Database\Eloquent\Model;

/**
 * Logs attendance check-in/check-out attempts when enabled in system settings.
 * action: check_in | check_out | attempt_failed
 * payload: { latitude, longitude, distance, within_range, reason?, timetable_id?, ... }
 */
class AttendanceActivityLog extends Model
{
    protected $table = 'attendance_activity_logs';

    protected $fillable = [
        'teacher_id',
        'action',
        'timetable_id',
        'payload',
        'ip_address',
        'user_agent',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
        ];
    }

    public function teacher()
    {
        return $this->belongsTo(Teacher::class);
    }

    public function timetable()
    {
        return $this->belongsTo(TimeTable::class);
    }

    /**
     * Log an attempt (check_in, check_out, or attempt_failed).
     */
    public static function logAttempt(
        string $action,
        ?int $teacherId = null,
        ?int $timetableId = null,
        array $payload = []
    ): void {
        $enabled = SystemSetting::getValue('attendance_logs_enabled', false);
        $logGps = SystemSetting::getValue('log_gps_attempts', false);
        $logFailed = SystemSetting::getValue('log_failed_attempts', true);

        $shouldLog = $enabled && (
            ($action !== 'attempt_failed' && $logGps) ||
            ($action === 'attempt_failed' && $logFailed)
        );

        if ($shouldLog) {
            self::query()->create([
                'teacher_id'    => $teacherId,
                'action'        => $action,
                'timetable_id'  => $timetableId,
                'payload'       => $payload,
                'ip_address'   => request()?->ip(),
                'user_agent'   => request()?->userAgent(),
            ]);
        }

        self::syncCentralAuditLog($action, $teacherId, $timetableId, $payload);
    }

    private static function syncCentralAuditLog(
        string $action,
        ?int $teacherId,
        ?int $timetableId,
        array $payload,
    ): void {
        $teacher = $teacherId ? Teacher::query()->find($teacherId) : null;
        $service = app(ActivityLogService::class);
        $mapped = $service->mapAttendanceAction($action, $payload);

        $service->logAttendance(
            eventType: $mapped['event_type'],
            description: $mapped['description'],
            status: $mapped['status'],
            actor: $teacher ? $service->actorFromTeacher($teacher) : null,
            metadata: array_merge($payload, [
                'teacher_id' => $teacherId,
                'timetable_id' => $timetableId,
                'legacy_action' => $action,
            ]),
            securityFlag: $mapped['security_flag'] ?? false,
        );
    }
}
