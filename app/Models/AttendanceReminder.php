<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AttendanceReminder extends Model
{
    public const TYPE_CHECK_IN = 'check_in';

    public const TYPE_CHECK_OUT = 'check_out';

    public const TRIGGER_BEFORE_START = 'before_start';

    public const TRIGGER_AFTER_START = 'after_start';

    public const TRIGGER_BEFORE_END = 'before_end';

    public const TRIGGER_AFTER_END = 'after_end';

    public const SCOPE_ALL = 'all';

    public const SCOPE_FACULTIES = 'faculties';

    public const SCOPE_DEPARTMENTS = 'departments';

    public const SCOPE_STAFF = 'staff';

    public const SCOPE_SELF = 'self';

    public const VIA_MAIL = 'mail';

    public const VIA_SMS = 'sms';

    public const VIA_BOTH = 'both';

    public const DAYS = [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
    ];

    protected $fillable = [
        'user_id',
        'teacher_id',
        'title',
        'type',
        'days',
        'trigger',
        'offset_minutes',
        'recipient_scope',
        'message',
        'send_via',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'days' => 'array',
            'offset_minutes' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class);
    }

    public function targets(): HasMany
    {
        return $this->hasMany(AttendanceReminderTarget::class);
    }

    public function dispatches(): HasMany
    {
        return $this->hasMany(AttendanceReminderDispatch::class);
    }

    public function typeLabel(): string
    {
        return $this->type === self::TYPE_CHECK_OUT ? 'Check-out' : 'Check-in';
    }

    public function triggerLabel(): string
    {
        return match ($this->trigger) {
            self::TRIGGER_BEFORE_START => 'Before scheduled session starts',
            self::TRIGGER_AFTER_START => 'After scheduled session starts',
            self::TRIGGER_BEFORE_END => 'Before scheduled session ends',
            default => 'After scheduled session ends',
        };
    }

    public function sendViaLabel(): string
    {
        return match ($this->send_via) {
            self::VIA_SMS => 'SMS',
            self::VIA_MAIL => 'Email',
            default => 'Email and SMS',
        };
    }

    public function scopeLabel(): string
    {
        return match ($this->recipient_scope) {
            self::SCOPE_SELF => 'Only me',
            self::SCOPE_FACULTIES => 'Selected faculties',
            self::SCOPE_DEPARTMENTS => 'Selected departments',
            self::SCOPE_STAFF => 'Selected staff',
            default => 'All eligible staff',
        };
    }
}
