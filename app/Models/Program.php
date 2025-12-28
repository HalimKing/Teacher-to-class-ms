<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Program extends Model
{
    //
    protected $fillable = [
        'name',
        'faculty_id',
        'department_id'
    ];

    public function department()
    {
        return $this->belongsTo(Department::class);
    }
    public function faculty()
    {
        return $this->belongsTo(Faculty::class);
    }
    public function courses()
    {
        return $this->hasMany(Course::class);
    }
}
