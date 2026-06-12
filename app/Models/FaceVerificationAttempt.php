<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FaceVerificationAttempt extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'teacher_id',
        'timetable_id',
        'score',
        'result',
        'failure_reason',
        'ip_address',
        'user_agent',
    ];

    protected function casts(): array
    {
        return [
            'score' => 'float',
            'created_at' => 'datetime',
        ];
    }

    public function teacher()
    {
        return $this->belongsTo(Teacher::class);
    }

    public function timetable()
    {
        return $this->belongsTo(TimeTable::class);
    }
}
