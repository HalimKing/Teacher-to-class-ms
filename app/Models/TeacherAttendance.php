<?php

namespace App\Models;

use App\Support\AttendanceLock;
use Illuminate\Database\Eloquent\Model;

class TeacherAttendance extends Model
{
    //
    protected $table = 'teacher_attendances';
    protected $fillable = [
        'teacher_id',
        'course_id',
        'timetable_id',
        'rescheduled_session_id',
        'classroom_id',
        'academic_year_id',
        'date',
        'check_in_time',
        'check_in_distance',
        'check_in_latitude',
        'check_in_longitude',
        'check_in_address',
        'check_in_within_range',
        'check_out_time',
        'check_out_address',
        'check_out_distance',
        'check_out_latitude',
        'check_out_longitude',
        'status',
        'arrival_category',
        'minutes_early',
        'minutes_late',
        'departure_category',
        'minutes_overtime',
        'face_verified',
        'face_match_score',
        'face_verified_at',
        'attendance_source',
        'auto_generated',
        'auto_generated_at',
        'auto_absence_reason',
        'exception_category',
        'holiday_break_id',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'face_verified' => 'boolean',
            'face_match_score' => 'float',
            'face_verified_at' => 'datetime',
            'check_in_within_range' => 'boolean',
            'check_out_within_range' => 'boolean',
            'auto_generated' => 'boolean',
            'auto_generated_at' => 'datetime',
            'minutes_early' => 'integer',
            'minutes_late' => 'integer',
            'minutes_overtime' => 'integer',
        ];
    }

    public function teacher()
    {
        return $this->belongsTo(Teacher::class);
    }

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function classroom()
    {
        return $this->belongsTo(ClassRoom::class);
    }

    public function timetable()
    {
        return $this->belongsTo(TimeTable::class);
    }

    public function rescheduledSession()
    {
        return $this->belongsTo(RescheduledSession::class, 'rescheduled_session_id');
    }
    public function academicYear()
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function holidayBreak()
    {
        return $this->belongsTo(HolidayBreak::class);
    }

    public function scopeActiveCheckIn($query)
    {
        return $query
            ->whereNotNull('check_in_time')
            ->whereNull('check_out_time')
            ->whereNotIn('status', AttendanceLock::LOCKED_STATUSES);
    }

    /**
     * True once the session has been finalized as an absence, which closes it
     * for further check-in or check-out.
     */
    public function isAbsenceLocked(): bool
    {
        return AttendanceLock::isLocked($this->status);
    }
}
