<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StaffAttendance extends Model
{
    protected $fillable = [
        'staff_id',
        'timetable_id',
        'classroom_id',
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
    ];

    protected $casts = [
        'date' => 'date',
        'check_in_within_range' => 'boolean',
        'check_out_within_range' => 'boolean',
        'face_verified' => 'boolean',
        'face_match_score' => 'float',
        'face_verified_at' => 'datetime',
        'auto_generated' => 'boolean',
        'auto_generated_at' => 'datetime',
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

    public function academicYear()
    {
        return $this->belongsTo(AcademicYear::class);
    }
}
