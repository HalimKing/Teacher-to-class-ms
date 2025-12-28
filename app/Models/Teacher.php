<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Teacher extends Model
{
    //
    protected $fillable = [
        'first_name',
        'last_name',
        'email',
        'phone',
        'faculty_id',
        'department_id',
        'title',
    ];

    public function faculty()
    {
        return $this->belongsTo(Faculty::class);
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function timeTables()
    {
        return $this->hasMany(TimeTable::class);
    }

    public function courses()
    {
        return $this->hasMany(Course::class);
    }
}
