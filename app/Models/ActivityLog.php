<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class ActivityLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'event_type',
        'event_category',
        'description',
        'status',
        'actor_type',
        'actor_id',
        'actor_name',
        'actor_role',
        'ip_address',
        'user_agent',
        'route',
        'method',
        'metadata',
        'is_security_flag',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'is_security_flag' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    public function actor(): MorphTo
    {
        return $this->morphTo(__FUNCTION__, 'actor_type', 'actor_id');
    }
}
