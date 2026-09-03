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

    protected function casts(): array
    {
        return [
            'capacity' => 'integer',
            'latitude' => 'float',
            'longitude' => 'float',
            'radius_meters' => 'float',
            'is_active' => 'boolean',
        ];
    }

     public function timeTables()
    {
        return $this->hasMany(TimeTable::class);
    }
}
