<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HelpDeskComment extends Model
{
    public const AUTHOR_TEACHER = 'teacher';
    public const AUTHOR_USER = 'user';

    protected $fillable = [
        'ticket_id',
        'body',
        'author_type',
        'author_id',
        'attachment_path',
        'attachment_name',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(HelpDeskTicket::class, 'ticket_id');
    }

    public function authorName(): string
    {
        if ($this->author_type === self::AUTHOR_TEACHER) {
            $teacher = Teacher::find($this->author_id);

            return $teacher
                ? trim("{$teacher->title} {$teacher->first_name} {$teacher->last_name}")
                : 'Staff member';
        }

        $user = User::find($this->author_id);

        return $user?->name ?? 'Support';
    }

    public function authorRoleLabel(): string
    {
        return $this->author_type === self::AUTHOR_TEACHER ? 'Staff' : 'Support';
    }
}
