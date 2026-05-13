<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ClassRoom extends Model
{
    //
    use HasFactory;
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
