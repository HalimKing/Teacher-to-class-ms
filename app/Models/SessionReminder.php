<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SessionReminder extends Model
{
    protected $fillable = [
        'teacher_id',
        'timetable_id',
        'title',
        'message',
        'send_via',
        'status',
        'error_message',
        'reminder_at',
        'triggered_at',
    ];

    protected $casts = [
        'reminder_at' => 'datetime',
        'triggered_at' => 'datetime',
    ];

    public function teacher()
    {
        return $this->belongsTo(Teacher::class);
    }

    public function timetable()
    {
        return $this->belongsTo(TimeTable::class);
    }

    public function isTriggered(): bool
    {
        return $this->triggered_at !== null;
    }
}
