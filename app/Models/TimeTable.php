<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TimeTable extends Model
{
    //
    protected $fillable = [
        'academic_year_id',
        'teacher_id',
        'staff_type',
        'course_id',
        'class_room_id',
        'day',
        'day_of_week',
        'start_time',
        'end_time',
    ];

    protected $attributes = [
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
    ];

    // today's lectures
    public static function todaysLectures()
    {
        return self::with('course.teacher', 'classroom')
            ->where('staff_type', Teacher::STAFF_TYPE_LECTURER)
            ->where('day_of_week', now()->format('l'))
            ->where('teacher_id', auth('teacher')->id())
            ->orderBy('start_time')
            ->get();
    }

    public static function todaysWorkPeriods()
    {
        return self::with('teacher')
            ->where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR)
            ->where('day_of_week', now()->format('l'))
            ->where('teacher_id', auth('teacher')->id())
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

    public function assignedStaff()
    {
        return $this->belongsTo(Teacher::class, 'teacher_id');
    }

    public function scopeForStaff($query, Teacher $teacher)
    {
        return $query->where('teacher_id', $teacher->id);
    }

    public function scopeForDay($query, string $day)
    {
        return $query->where('day_of_week', $day);
    }

    public function isLecturerPeriod(): bool
    {
        return $this->staff_type === Teacher::STAFF_TYPE_LECTURER;
    }

    public function isAdministratorPeriod(): bool
    {
        return $this->staff_type === Teacher::STAFF_TYPE_ADMINISTRATOR;
    }
}
