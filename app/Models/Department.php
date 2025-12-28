<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Department extends Model
{
    //
    protected $fillable = [
        'name',
        'faculty_id'
    ];

    public function faculty()
    {
        return $this->belongsTo(Faculty::class);
    }

    public function teachers()
    {
        return $this->hasMany(Teacher::class);
    }
    public function program()
    {
        return $this->hasMany(Program::class);
    }
}
