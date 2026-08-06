<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceExplanation extends Model
{
    public const TYPE_ABSENCE = 'absence';
    public const TYPE_EARLY_DEPARTURE = 'early_departure';

    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    public const ATTENDANCE_STAFF = 'staff';
    public const ATTENDANCE_TEACHER = 'teacher';

    public const REASON_CATEGORIES = [
        'sick_leave' => 'Sick Leave',
        'official_assignment' => 'Official Assignment',
        'training' => 'Training',
        'emergency' => 'Emergency',
        'personal_leave' => 'Personal Leave',
        'other' => 'Other',
    ];

    protected $fillable = [
        'staff_id',
        'attendance_type',
        'attendance_id',
        'timetable_id',
        'attendance_date',
        'explanation_type',
        'reason_category',
        'explanation',
        'supporting_document_path',
        'supporting_document_name',
        'status',
        'reviewed_by',
        'reviewed_at',
        'admin_comments',
        'status_applied',
    ];

    protected function casts(): array
    {
        return [
            'attendance_date' => 'date',
            'reviewed_at' => 'datetime',
        ];
    }

    public function staff(): BelongsTo
    {
        return $this->belongsTo(Teacher::class, 'staff_id');
    }

    public function timetable(): BelongsTo
    {
        return $this->belongsTo(TimeTable::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function attendanceRecord(): ?Model
    {
        return match ($this->attendance_type) {
            self::ATTENDANCE_STAFF => StaffAttendance::query()->find($this->attendance_id),
            self::ATTENDANCE_TEACHER => TeacherAttendance::query()->find($this->attendance_id),
            default => null,
        };
    }

    public function reasonCategoryLabel(): string
    {
        return self::REASON_CATEGORIES[$this->reason_category] ?? $this->reason_category;
    }

    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_PENDING);
    }
}
