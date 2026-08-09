<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HolidayBreakCoverageAssignment extends Model
{
    protected $fillable = [
        'holiday_break_id',
        'teacher_id',
        'created_by',
    ];

    public function holidayBreak(): BelongsTo
    {
        return $this->belongsTo(HolidayBreak::class);
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
