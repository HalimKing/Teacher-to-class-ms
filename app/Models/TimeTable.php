<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TimeTable extends Model
{
    //
    protected $fillable = [
        'academic_year_id',
        'course_id',
        'class_room_id',
        'teacher_id',
        'day',
        'start_time',
        'end_time',
    ];

    // today's lectures
    public static function todaysLectures()
    {
        return self::with('course.teacher', 'classroom')
            ->where('day', now()->format('l'))
            ->whereHas('course', function($query) {
                $query->where('teacher_id', auth()->id());
            })
            ->orderBy('start_time')
            ->get();
    }

    

    public function academicYear()
    {
        return $this->belongsTo(AcademicYear::class);
    }
    public function course()
    {
        return $this->belongsTo(Course::class);
    }
    public function classRoom()
    {
        return $this->belongsTo(ClassRoom::class);
    }
    public function teacher()
    {
        return $this->belongsTo(Teacher::class);
    }
}
