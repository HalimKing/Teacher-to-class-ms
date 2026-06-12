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
        'face_descriptor',
        'face_registered_at',
    ];

    protected $hidden = [
        'face_descriptor',
    ];

    protected function casts(): array
    {
        return [
            'face_descriptor' => 'encrypted:array',
            'face_registered_at' => 'datetime',
        ];
    }

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

    public function teachingTimeTables()
    {
        return $this->hasMany(TimeTable::class)
            ->where('staff_type', self::STAFF_TYPE_LECTURER);
    }

    public function workTimeTables()
    {
        return $this->hasMany(TimeTable::class)
            ->where('staff_type', self::STAFF_TYPE_ADMINISTRATOR);
    }

    public function staffAttendances()
    {
        return $this->hasMany(StaffAttendance::class, 'staff_id');
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

    public function hasFaceEnrollment(): bool
    {
        return !empty($this->face_descriptor) && $this->face_registered_at !== null;
    }

    public function faceEnrollmentStatus(): string
    {
        return $this->hasFaceEnrollment() ? 'enrolled' : 'not_enrolled';
    }
}
