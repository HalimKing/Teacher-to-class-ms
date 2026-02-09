<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TeacherAttendance extends Model
{
    //
    protected $table = 'teacher_attendances';
    protected $fillable = [
        'teacher_id',
        'course_id',
        'timetable_id',
        'classroom_id',
        'timetable_id',
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

    ];

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
}
