<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RescheduledSession extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_ACTIVE = 'active';

    protected $table = 'rescheduled_sessions';

    protected $fillable = [
        'timetable_id',
        'classroom_id',
        'teacher_id',
        'original_date',
        'original_start_time',
        'original_end_time',
        'new_date',
        'new_start_time',
        'new_end_time',
        'reason',
        'note',
        'status',
        'approved_by',
        'approved_at',
        'rejected_reason',
        'admin_remarks'
    ];

    protected function casts(): array
    {
        return [
            'original_date' => 'date',
            'new_date' => 'date',
            'approved_at' => 'datetime',
        ];
    }

    public function timetable()
    {
        return $this->belongsTo(TimeTable::class, 'timetable_id');
    }

    public function classroom()
    {
        return $this->belongsTo(ClassRoom::class, 'classroom_id');
    }

    public function teacher()
    {
        return $this->belongsTo(Teacher::class, 'teacher_id');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function attendances()
    {
        return $this->hasMany(TeacherAttendance::class, 'rescheduled_session_id');
    }

    public function scopeApproved($query)
    {
        return $query->whereIn('status', self::approvedStatuses());
    }

    /**
     * @return array<int, string>
     */
    public static function approvedStatuses(): array
    {
        return [self::STATUS_APPROVED, self::STATUS_ACTIVE];
    }

    public function isApproved(): bool
    {
        return in_array($this->status, self::approvedStatuses(), true);
    }
}
