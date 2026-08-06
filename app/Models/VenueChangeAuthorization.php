<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VenueChangeAuthorization extends Model
{
    public const TYPE_CHECK_IN = 'check_in';
    public const TYPE_CHECK_OUT = 'check_out';
    public const TYPE_BOTH = 'both';

    public const STATUS_ACTIVE = 'active';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_REVOKED = 'revoked';

    protected $fillable = [
        'bulk_group_id',
        'source_request_id',
        'staff_id',
        'timetable_id',
        'original_classroom_id',
        'authorized_classroom_id',
        'authorization_type',
        'start_date',
        'end_date',
        'start_time',
        'end_time',
        'reason',
        'notes',
        'status',
        'approved_by',
        'approved_at',
        'revoked_by',
        'revoked_at',
        'revoke_reason',
    ];

    protected $appends = [
        'period_label',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'approved_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function staff(): BelongsTo
    {
        return $this->belongsTo(Teacher::class, 'staff_id');
    }

    public function timetable(): BelongsTo
    {
        return $this->belongsTo(TimeTable::class);
    }

    public function originalClassroom(): BelongsTo
    {
        return $this->belongsTo(ClassRoom::class, 'original_classroom_id');
    }

    public function authorizedClassroom(): BelongsTo
    {
        return $this->belongsTo(ClassRoom::class, 'authorized_classroom_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function revoker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'revoked_by');
    }

    public function bulkSiblings(): HasMany
    {
        return $this->hasMany(self::class, 'bulk_group_id', 'bulk_group_id');
    }

    public function sourceRequest(): BelongsTo
    {
        return $this->belongsTo(VenueChangeRequest::class, 'source_request_id');
    }

    public function allowsCheckIn(): bool
    {
        return in_array($this->authorization_type, [self::TYPE_CHECK_IN, self::TYPE_BOTH], true);
    }

    public function allowsCheckOut(): bool
    {
        return in_array($this->authorization_type, [self::TYPE_CHECK_OUT, self::TYPE_BOTH], true);
    }

    public function isBulk(): bool
    {
        return filled($this->bulk_group_id);
    }

    public function coversDate(Carbon|string $date): bool
    {
        $day = $date instanceof Carbon ? $date->toDateString() : Carbon::parse($date)->toDateString();

        return $this->start_date?->toDateString() <= $day
            && $this->end_date?->toDateString() >= $day;
    }

    public function getPeriodLabelAttribute(): string
    {
        if (!$this->start_date || !$this->end_date) {
            return '—';
        }

        $start = $this->start_date->format('d M Y');
        $end = $this->end_date->format('d M Y');

        return $start === $end ? $start : "{$start} – {$end}";
    }

    public function isCurrentlyValid(?Carbon $reference = null): bool
    {
        $reference ??= now();

        if ($this->status !== self::STATUS_ACTIVE) {
            return false;
        }

        if (!$this->coversDate($reference)) {
            return false;
        }

        // Optional daily time window applies on each day within the period.
        if ($this->start_time) {
            $start = Carbon::parse($reference->toDateString() . ' ' . $this->normalizeTime($this->start_time));
            if ($reference->lt($start)) {
                return false;
            }
        }

        if ($this->end_time) {
            $end = Carbon::parse($reference->toDateString() . ' ' . $this->normalizeTime($this->end_time));
            if ($reference->gt($end)) {
                return false;
            }
        }

        return true;
    }

    public function scopeActive($query)
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    public function scopeForStaffOnDate($query, int $staffId, string $date)
    {
        return $query
            ->where('staff_id', $staffId)
            ->whereDate('start_date', '<=', $date)
            ->whereDate('end_date', '>=', $date);
    }

    public function scopeOverlappingPeriod($query, string $startDate, string $endDate)
    {
        return $query
            ->whereDate('start_date', '<=', $endDate)
            ->whereDate('end_date', '>=', $startDate);
    }

    private function normalizeTime(string $time): string
    {
        return strlen($time) === 5 ? "{$time}:00" : $time;
    }
}
