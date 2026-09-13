<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SelfReportedAbsenceReply extends Model
{
    protected $fillable = [
        'attendance_kind',
        'attendance_id',
        'author_id',
        'body',
    ];

    public function author(): BelongsTo
    {
        return $this->belongsTo(Teacher::class, 'author_id');
    }
}
