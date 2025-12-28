<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Course extends Model
{
    //
    protected $fillable = [
        'course_code',
        'name',
        'program_id',
        'level_id',
        'academic_year_id',
        'academic_period_id',
        'course_type',
        'credit_hours',
        'teacher_id',
    ];
    public function program()
    {
        return $this->belongsTo(Program::class);
    }

   public function level()
    {
        return $this->belongsTo(Level::class);
    }

    public function academicYear()
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function academicPeriod()
    {
        return $this->belongsTo(AcademicPeriod::class);
    }

     public function timeTables()
    {
        return $this->hasMany(TimeTable::class);
    }

    public function teacher()
    {
        return $this->belongsTo(Teacher::class);
    }

   

}
