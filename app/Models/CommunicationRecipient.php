<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommunicationRecipient extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_DELIVERED = 'delivered';

    public const STATUS_FAILED = 'failed';

    public const STATUS_READ = 'read';

    public const STATUS_LABELS = [
        self::STATUS_PENDING => 'Pending',
        self::STATUS_DELIVERED => 'Delivered',
        self::STATUS_FAILED => 'Failed',
        self::STATUS_READ => 'Read',
    ];

    protected $fillable = [
        'communication_id',
        'teacher_id',
        'status',
        'delivered_at',
        'read_at',
        'error_message',
    ];

    protected function casts(): array
    {
        return [
            'delivered_at' => 'datetime',
            'read_at' => 'datetime',
        ];
    }

    public function communication(): BelongsTo
    {
        return $this->belongsTo(Communication::class);
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class);
    }

    public function statusLabel(): string
    {
        return self::STATUS_LABELS[$this->status] ?? ucfirst((string) $this->status);
    }
}
