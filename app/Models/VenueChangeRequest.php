<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VenueChangeRequest extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    public const TYPE_CHECK_IN = 'check_in';
    public const TYPE_CHECK_OUT = 'check_out';
    public const TYPE_BOTH = 'both';

    protected $fillable = [
        'staff_id',
        'authorized_classroom_id',
        'authorization_type',
        'start_date',
        'end_date',
        'start_time',
        'end_time',
        'reason',
        'notes',
        'status',
        'reviewed_by',
        'reviewed_at',
        'admin_comments',
        'resulting_bulk_group_id',
        'resulting_authorization_id',
    ];

    protected $appends = [
        'period_label',
        'status_label',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'reviewed_at' => 'datetime',
        ];
    }

    public function staff(): BelongsTo
    {
        return $this->belongsTo(Teacher::class, 'staff_id');
    }

    public function authorizedClassroom(): BelongsTo
    {
        return $this->belongsTo(ClassRoom::class, 'authorized_classroom_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(VenueChangeRequestItem::class);
    }

    public function resultingAuthorization(): BelongsTo
    {
        return $this->belongsTo(VenueChangeAuthorization::class, 'resulting_authorization_id');
    }

    public function resultingAuthorizations(): HasMany
    {
        return $this->hasMany(VenueChangeAuthorization::class, 'source_request_id');
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
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

    public function getStatusLabelAttribute(): string
    {
        return match ($this->status) {
            self::STATUS_PENDING => 'Pending approval',
            self::STATUS_APPROVED => 'Approved authorization',
            self::STATUS_REJECTED => 'Rejected request',
            default => ucfirst((string) $this->status),
        };
    }

    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_PENDING);
    }
}
