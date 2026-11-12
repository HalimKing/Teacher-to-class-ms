<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceReminderTarget extends Model
{
    public const TYPE_FACULTY = 'faculty';

    public const TYPE_DEPARTMENT = 'department';

    public const TYPE_TEACHER = 'teacher';

    public const TYPE_TIMETABLE = 'timetable';

    protected $fillable = [
        'attendance_reminder_id',
        'target_type',
        'target_id',
    ];

    public function reminder(): BelongsTo
    {
        return $this->belongsTo(AttendanceReminder::class, 'attendance_reminder_id');
    }
}
