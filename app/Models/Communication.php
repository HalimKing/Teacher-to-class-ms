<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Communication extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_SENDING = 'sending';

    public const STATUS_SENT = 'sent';

    public const STATUS_PARTIAL = 'partial';

    public const STATUS_FAILED = 'failed';

    public const STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_SENDING,
        self::STATUS_SENT,
        self::STATUS_PARTIAL,
        self::STATUS_FAILED,
    ];

    public const STATUS_LABELS = [
        self::STATUS_DRAFT => 'Draft',
        self::STATUS_SENDING => 'Sending',
        self::STATUS_SENT => 'Sent',
        self::STATUS_PARTIAL => 'Partially delivered',
        self::STATUS_FAILED => 'Failed',
    ];

    protected $fillable = [
        'sender_type',
        'sender_id',
        'subject',
        'body',
        'status',
        'recipient_count',
        'delivered_count',
        'read_count',
        'audience_summary',
        'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'audience_summary' => 'array',
            'sent_at' => 'datetime',
        ];
    }

    public function sender(): MorphTo
    {
        return $this->morphTo();
    }

    public function targets(): HasMany
    {
        return $this->hasMany(CommunicationTarget::class);
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(CommunicationRecipient::class);
    }

    public function statusLabel(): string
    {
        return self::STATUS_LABELS[$this->status] ?? ucfirst((string) $this->status);
    }

    public function isDraft(): bool
    {
        return $this->status === self::STATUS_DRAFT;
    }
}
