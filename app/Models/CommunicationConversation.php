<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class CommunicationConversation extends Model
{
    protected $fillable = [
        'subject',
        'started_by_type',
        'started_by_id',
        'message_count',
        'last_message_preview',
        'last_message_at',
    ];

    protected function casts(): array
    {
        return [
            'last_message_at' => 'datetime',
        ];
    }

    public function startedBy(): MorphTo
    {
        return $this->morphTo();
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Communication::class, 'conversation_id');
    }

    public function latestMessage(): HasOne
    {
        return $this->hasOne(Communication::class, 'conversation_id')->latestOfMany('id');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(CommunicationConversationParticipant::class, 'conversation_id');
    }
}
