<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdminAttendance extends Model
{
    protected $table = 'admin_attendances';
    protected $fillable = [
        'admin_id',
        'teacher_id',
        'course_id',
        'timetable_id',
        'classroom_id',
        'academic_year_id',
        'faculty_id',
        'department_id',
        'program_id',
        'level_id',
        'date',
        'action', // e.g. viewed, exported, etc.
        'filters', // json of filters used
    ];

    public function admin() { return $this->belongsTo(User::class, 'admin_id'); }
    public function teacher() { return $this->belongsTo(Teacher::class, 'teacher_id'); }
    public function course() { return $this->belongsTo(Course::class, 'course_id'); }
    public function timetable() { return $this->belongsTo(TimeTable::class, 'timetable_id'); }
    public function classroom() { return $this->belongsTo(ClassRoom::class, 'classroom_id'); }
    public function academicYear() { return $this->belongsTo(AcademicYear::class, 'academic_year_id'); }
    public function faculty() { return $this->belongsTo(Faculty::class, 'faculty_id'); }
    public function department() { return $this->belongsTo(Department::class, 'department_id'); }
    public function program() { return $this->belongsTo(Program::class, 'program_id'); }
    public function level() { return $this->belongsTo(Level::class, 'level_id'); }
}
