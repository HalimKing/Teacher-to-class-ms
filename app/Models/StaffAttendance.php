<?php

namespace App\Models;

use App\Support\AttendanceLock;
use Illuminate\Database\Eloquent\Model;

class StaffAttendance extends Model
{
    protected $fillable = [
        'staff_id',
        'timetable_id',
        'classroom_id',
        'venue_change_authorization_id',
        'authorized_venue_used',
        'academic_year_id',
        'date',
        'check_in_time',
        'check_out_time',
        'latitude',
        'longitude',
        'check_out_latitude',
        'check_out_longitude',
        'check_in_distance',
        'check_out_distance',
        'check_in_within_range',
        'check_out_within_range',
        'attendance_status',
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

    protected $casts = [
        'date' => 'date',
        'check_in_within_range' => 'boolean',
        'check_out_within_range' => 'boolean',
        'authorized_venue_used' => 'boolean',
        'face_verified' => 'boolean',
        'face_match_score' => 'float',
        'face_verified_at' => 'datetime',
        'auto_generated' => 'boolean',
        'auto_generated_at' => 'datetime',
        'minutes_early' => 'integer',
        'minutes_late' => 'integer',
        'minutes_overtime' => 'integer',
    ];

    public function staff()
    {
        return $this->belongsTo(Teacher::class, 'staff_id');
    }

    public function timetable()
    {
        return $this->belongsTo(TimeTable::class);
    }

    public function classroom()
    {
        return $this->belongsTo(ClassRoom::class, 'classroom_id');
    }

    public function venueChangeAuthorization()
    {
        return $this->belongsTo(VenueChangeAuthorization::class);
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
            ->whereNotIn('attendance_status', AttendanceLock::LOCKED_STATUSES);
    }

    /**
     * True once the session has been finalized as an absence, which closes it
     * for further check-in or check-out.
     */
    public function isAbsenceLocked(): bool
    {
        return AttendanceLock::isLocked($this->attendance_status);
    }
}
