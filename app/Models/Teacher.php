<?php

namespace App\Models;

use App\Services\FacialRecognitionService;
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

    public const EMPLOYMENT_STATUS_PERMANENT = 'permanent';
    public const EMPLOYMENT_STATUS_NSS = 'nss';
    public const EMPLOYMENT_STATUS_INTERN = 'intern';
    public const EMPLOYMENT_STATUS_VOLUNTEER = 'volunteer';
    public const EMPLOYMENT_STATUS_OTHER = 'other';

    public const EMPLOYMENT_STATUSES = [
        self::EMPLOYMENT_STATUS_PERMANENT,
        self::EMPLOYMENT_STATUS_NSS,
        self::EMPLOYMENT_STATUS_INTERN,
        self::EMPLOYMENT_STATUS_VOLUNTEER,
        self::EMPLOYMENT_STATUS_OTHER,
    ];

    public const EMPLOYMENT_STATUS_LABELS = [
        self::EMPLOYMENT_STATUS_PERMANENT => 'Permanent Staff',
        self::EMPLOYMENT_STATUS_NSS => 'NSS Personnel',
        self::EMPLOYMENT_STATUS_INTERN => 'Intern',
        self::EMPLOYMENT_STATUS_VOLUNTEER => 'Volunteer',
        self::EMPLOYMENT_STATUS_OTHER => 'Other',
    ];

    protected $guard = 'teacher';

    protected $attributes = [
        'staff_type' => self::STAFF_TYPE_LECTURER,
        'employment_status' => self::EMPLOYMENT_STATUS_PERMANENT,
    ];

    protected $fillable = [
        'first_name',
        'last_name',
        'email',
        'phone',
        'password',
        'faculty_id',
        'department_id',
        'employee_id',
        'title',
        'staff_type',
        'employment_status',
        'face_descriptor',
        'face_registered_at',
        'password_changed_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'face_descriptor',
    ];

    protected $appends = [
        'employment_status_label',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
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

    public function employmentStatusLabel(): string
    {
        return $this->employment_status_label;
    }

    public function getEmploymentStatusLabelAttribute(): string
    {
        $status = $this->attributes['employment_status'] ?? self::EMPLOYMENT_STATUS_PERMANENT;

        return self::EMPLOYMENT_STATUS_LABELS[$status]
            ?? self::EMPLOYMENT_STATUS_LABELS[self::EMPLOYMENT_STATUS_PERMANENT];
    }

    public function hasFaceEnrollment(): bool
    {
        return app(FacialRecognitionService::class)->hasValidEnrollment($this);
    }

    public function faceEnrollmentStatus(): string
    {
        return $this->hasFaceEnrollment() ? 'enrolled' : 'not_enrolled';
    }
}
