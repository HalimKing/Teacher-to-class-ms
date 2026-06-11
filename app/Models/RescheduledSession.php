<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RescheduledSession extends Model
{
    protected $table = 'rescheduled_sessions';

    protected $fillable = [
        'timetable_id',
        'classroom_id',
        'teacher_id',
        'original_date',
        'original_start_time',
        'original_end_time',
        'new_date',
        'new_start_time',
        'new_end_time',
        'reason',
        'note',
        'status',
        'approved_by',
        'approved_at',
        'rejected_reason',
        'admin_remarks'
    ];

    public function timetable()
    {
        return $this->belongsTo(TimeTable::class, 'timetable_id');
    }

    public function classroom()
    {
        return $this->belongsTo(ClassRoom::class, 'classroom_id');
    }

    public function teacher()
    {
        return $this->belongsTo(Teacher::class, 'teacher_id');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
