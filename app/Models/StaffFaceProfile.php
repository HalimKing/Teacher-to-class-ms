<?php

namespace App\Models;

use App\Casts\NullableEncryptedArray;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffFaceProfile extends Model
{
    protected $hidden = [
        'embedding',
    ];

    protected $fillable = [
        'teacher_id',
        'embedding',
        'embedding_dimension',
        'embedding_model',
        'embedding_version',
        'quality_score',
        'liveness_score',
        'enrolled_at',
        'last_verified_at',
        'is_active',
        'migration_required',
    ];

    protected function casts(): array
    {
        return [
            'embedding' => NullableEncryptedArray::class,
            'embedding_dimension' => 'integer',
            'quality_score' => 'float',
            'liveness_score' => 'float',
            'enrolled_at' => 'datetime',
            'last_verified_at' => 'datetime',
            'is_active' => 'boolean',
            'migration_required' => 'boolean',
        ];
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class);
    }
}
