<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class AcademicYear extends Model
{
    //
    protected $fillable = [
        'name',
        'status',
    ];

    public function timeTables()
    {
        return $this->hasMany(TimeTable::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active');
    }
}
