<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TeacherNotificationPreference extends Model
{
    protected $fillable = [
        'teacher_id',
        'attendance_enabled',
        'timetable_enabled',
        'administrative_enabled',
        'system_enabled',
        'email_enabled',
    ];

    protected function casts(): array
    {
        return [
            'attendance_enabled' => 'boolean',
            'timetable_enabled' => 'boolean',
            'administrative_enabled' => 'boolean',
            'system_enabled' => 'boolean',
            'email_enabled' => 'boolean',
        ];
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class);
    }

    public static function forTeacher(Teacher|int $teacher): self
    {
        $teacherId = $teacher instanceof Teacher ? $teacher->id : $teacher;

        return self::firstOrCreate(
            ['teacher_id' => $teacherId],
            [
                'attendance_enabled' => true,
                'timetable_enabled' => true,
                'administrative_enabled' => true,
                'system_enabled' => true,
                'email_enabled' => true,
            ],
        );
    }

    public function isCategoryEnabled(string $category): bool
    {
        return match ($category) {
            'attendance' => $this->attendance_enabled,
            'timetable' => $this->timetable_enabled,
            'administrative' => $this->administrative_enabled,
            'system' => $this->system_enabled,
            default => true,
        };
    }
}
