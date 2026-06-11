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

    public const STAFF_TYPE_LECTURER = 'lecturer';
    public const STAFF_TYPE_ADMINISTRATOR = 'administrator';

    public const STAFF_TYPES = [
        self::STAFF_TYPE_LECTURER,
        self::STAFF_TYPE_ADMINISTRATOR,
    ];

    protected $guard = 'teacher';

    protected $attributes = [
        'staff_type' => self::STAFF_TYPE_LECTURER,
    ];

    protected $fillable = [
        'first_name',
        'last_name',
        'email',
        'phone',
        'faculty_id',
        'department_id',
        'employee_id',
        'title',
        'staff_type',
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

    public function sessionReminders()
    {
        return $this->hasMany(SessionReminder::class);
    }

    public function isLecturer(): bool
    {
        return $this->staff_type === self::STAFF_TYPE_LECTURER;
    }

    public function isAdministrator(): bool
    {
        return $this->staff_type === self::STAFF_TYPE_ADMINISTRATOR;
    }
}
