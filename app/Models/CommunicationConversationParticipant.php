<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class CommunicationConversationParticipant extends Model
{
    protected $fillable = [
        'conversation_id',
        'participant_type',
        'participant_id',
        'last_read_at',
        'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'last_read_at' => 'datetime',
            'archived_at' => 'datetime',
        ];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(CommunicationConversation::class, 'conversation_id');
    }

    public function participant(): MorphTo
    {
        return $this->morphTo();
    }
}
