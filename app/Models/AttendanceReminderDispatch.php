<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceReminderDispatch extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_SENT = 'sent';

    public const STATUS_FAILED = 'failed';

    public const STATUS_SKIPPED = 'skipped';

    protected $fillable = [
        'attendance_reminder_id',
        'teacher_id',
        'timetable_id',
        'session_date',
        'rescheduled_session_id',
        'scheduled_for',
        'notified_at',
        'channel',
        'status',
        'failure_reason',
    ];

    protected function casts(): array
    {
        return [
            'session_date' => 'date',
            'scheduled_for' => 'datetime',
            'notified_at' => 'datetime',
        ];
    }

    public function reminder(): BelongsTo
    {
        return $this->belongsTo(AttendanceReminder::class, 'attendance_reminder_id');
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class);
    }

    public function timetable(): BelongsTo
    {
        return $this->belongsTo(TimeTable::class);
    }
}
