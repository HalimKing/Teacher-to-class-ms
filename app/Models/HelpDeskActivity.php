<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HelpDeskActivity extends Model
{
    public $timestamps = false;

    public const ACTION_CREATED = 'created';
    public const ACTION_STATUS_CHANGED = 'status_changed';
    public const ACTION_ASSIGNED = 'assigned';
    public const ACTION_COMMENTED = 'commented';
    public const ACTION_CLOSED = 'closed';

    protected $fillable = [
        'ticket_id',
        'actor_type',
        'actor_id',
        'action',
        'from_value',
        'to_value',
        'meta',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(HelpDeskTicket::class, 'ticket_id');
    }

    public function actorName(): ?string
    {
        if (!$this->actor_type || !$this->actor_id) {
            return null;
        }

        if ($this->actor_type === HelpDeskComment::AUTHOR_TEACHER) {
            $teacher = Teacher::find($this->actor_id);

            return $teacher
                ? trim("{$teacher->title} {$teacher->first_name} {$teacher->last_name}")
                : null;
        }

        return User::find($this->actor_id)?->name;
    }
}
