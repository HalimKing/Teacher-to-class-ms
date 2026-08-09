<?php

namespace App\Models;

use App\Support\HolidayBreakCoverage;
use App\Support\HolidayBreakType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HolidayBreak extends Model
{
    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';

    protected $fillable = [
        'name',
        'type',
        'start_date',
        'end_date',
        'description',
        'status',
        'coverage_type',
        'created_by',
    ];

    protected $attributes = [
        'coverage_type' => HolidayBreakCoverage::ALL_STAFF,
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function dutyAssignments(): HasMany
    {
        return $this->hasMany(HolidayBreakDutyAssignment::class);
    }

    public function coverageAssignments(): HasMany
    {
        return $this->hasMany(HolidayBreakCoverageAssignment::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    public function scopeCoveringDate(Builder $query, string $date): Builder
    {
        return $query
            ->whereDate('start_date', '<=', $date)
            ->whereDate('end_date', '>=', $date);
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function isPublicHoliday(): bool
    {
        return HolidayBreakType::isPublicHoliday($this->type);
    }

    public function typeLabel(): string
    {
        return HolidayBreakType::label($this->type);
    }

    public function coverageLabel(): string
    {
        return HolidayBreakCoverage::label($this->coverage_type);
    }

    public function coversDate(string $date): bool
    {
        $day = $date;
        $start = $this->start_date?->toDateString();
        $end = $this->end_date?->toDateString();

        return $start !== null && $end !== null && $day >= $start && $day <= $end;
    }
}
