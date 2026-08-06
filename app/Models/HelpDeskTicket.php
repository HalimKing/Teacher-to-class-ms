<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HelpDeskTicket extends Model
{
    public const CATEGORY_TECHNICAL = 'technical';
    public const CATEGORY_ACCOUNT = 'account';
    public const CATEGORY_SYSTEM_REQUEST = 'system_request';
    public const CATEGORY_OTHER = 'other';

    public const CATEGORIES = [
        self::CATEGORY_TECHNICAL => 'Technical Issue',
        self::CATEGORY_ACCOUNT => 'Account Issue',
        self::CATEGORY_SYSTEM_REQUEST => 'System Request',
        self::CATEGORY_OTHER => 'Other',
    ];

    public const PRIORITY_LOW = 'low';
    public const PRIORITY_MEDIUM = 'medium';
    public const PRIORITY_HIGH = 'high';
    public const PRIORITY_URGENT = 'urgent';

    public const PRIORITIES = [
        self::PRIORITY_LOW => 'Low',
        self::PRIORITY_MEDIUM => 'Medium',
        self::PRIORITY_HIGH => 'High',
        self::PRIORITY_URGENT => 'Urgent',
    ];

    public const STATUS_OPEN = 'open';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_RESOLVED = 'resolved';
    public const STATUS_CLOSED = 'closed';

    public const STATUSES = [
        self::STATUS_OPEN => 'Open',
        self::STATUS_IN_PROGRESS => 'In Progress',
        self::STATUS_RESOLVED => 'Resolved',
        self::STATUS_CLOSED => 'Closed',
    ];

    protected $fillable = [
        'ticket_number',
        'subject',
        'description',
        'category',
        'priority',
        'status',
        'created_by',
        'assigned_to',
        'attachment_path',
        'attachment_name',
        'resolved_at',
        'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'resolved_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Teacher::class, 'created_by');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(HelpDeskComment::class, 'ticket_id')->latest('id');
    }

    public function activities(): HasMany
    {
        return $this->hasMany(HelpDeskActivity::class, 'ticket_id')->latest('id');
    }

    public function categoryLabel(): string
    {
        return self::CATEGORIES[$this->category] ?? ucfirst(str_replace('_', ' ', (string) $this->category));
    }

    public function priorityLabel(): string
    {
        return self::PRIORITIES[$this->priority] ?? ucfirst((string) $this->priority);
    }

    public function statusLabel(): string
    {
        return self::STATUSES[$this->status] ?? ucfirst(str_replace('_', ' ', (string) $this->status));
    }
}
