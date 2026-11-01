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
        'liveness_passed',
        'quality_score',
        'processing_time_ms',
        'engine',
        'ip_address',
        'user_agent',
    ];

    protected function casts(): array
    {
        return [
            'score' => 'float',
            'liveness_passed' => 'boolean',
            'quality_score' => 'float',
            'processing_time_ms' => 'integer',
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
