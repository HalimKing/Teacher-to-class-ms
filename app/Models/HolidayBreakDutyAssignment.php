<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HolidayBreakDutyAssignment extends Model
{
    protected $fillable = [
        'holiday_break_id',
        'teacher_id',
        'duty_dates',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'duty_dates' => 'array',
        ];
    }

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

    public function isDutyRequiredOn(string $date): bool
    {
        $dates = $this->duty_dates;

        if (! is_array($dates) || $dates === []) {
            return true;
        }

        return in_array($date, $dates, true);
    }
}
