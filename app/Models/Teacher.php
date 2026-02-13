<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class Teacher extends Authenticatable

{
    //
    /**     * The attributes that are mass assignable.
     * @var list<string>
     */
    use Notifiable;

    protected $guard = 'teacher';

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
        return $this->hasManyThrough(TimeTable::class , Course::class);
    }

    public function courses()
    {
        return $this->hasMany(Course::class);
    }
}
