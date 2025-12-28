<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Faculty extends Model
{
    //
    protected $fillable = [
        'name',
        'description'
    ];

    public function departments()
    {
        return $this->hasMany(Department::class);
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
