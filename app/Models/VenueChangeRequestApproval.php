<?php

namespace App\Models;

use App\Support\VenueChangeApprovalRole;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class VenueChangeRequestApproval extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'venue_change_request_id',
        'role',
        'status',
        'assigned_teacher_id',
        'decided_by_type',
        'decided_by_id',
        'comments',
        'decided_at',
    ];

    protected function casts(): array
    {
        return [
            'decided_at' => 'datetime',
        ];
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(VenueChangeRequest::class, 'venue_change_request_id');
    }

    public function assignedTeacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class, 'assigned_teacher_id');
    }

    public function decidedBy(): MorphTo
    {
        return $this->morphTo();
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function isApproved(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }

    public function isRejected(): bool
    {
        return $this->status === self::STATUS_REJECTED;
    }

    public function roleLabel(): string
    {
        return VenueChangeApprovalRole::label($this->role);
    }

    public function statusLabel(): string
    {
        return match ($this->status) {
            self::STATUS_PENDING => 'Awaiting approval',
            self::STATUS_APPROVED => 'Approved',
            self::STATUS_REJECTED => 'Rejected',
            default => ucfirst((string) $this->status),
        };
    }

    public function decidedByName(): ?string
    {
        $actor = $this->decidedBy;

        if ($actor instanceof Teacher) {
            return $actor->displayName();
        }

        if ($actor instanceof User) {
            return $actor->name;
        }

        return null;
    }
}
