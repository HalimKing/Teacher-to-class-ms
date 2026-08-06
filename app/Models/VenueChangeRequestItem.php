<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VenueChangeRequestItem extends Model
{
    protected $fillable = [
        'venue_change_request_id',
        'timetable_id',
        'original_classroom_id',
    ];

    public function request(): BelongsTo
    {
        return $this->belongsTo(VenueChangeRequest::class, 'venue_change_request_id');
    }

    public function timetable(): BelongsTo
    {
        return $this->belongsTo(TimeTable::class);
    }

    public function originalClassroom(): BelongsTo
    {
        return $this->belongsTo(ClassRoom::class, 'original_classroom_id');
    }
}
