<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClassRoom extends Model
{
    //
    protected $fillable = [
        'name',
        'capacity',
        'latitude',
        'longitude',
        'radius_meters',
        'is_active',
    ];

     public function timeTables()
    {
        return $this->hasMany(TimeTable::class);
    }
}
