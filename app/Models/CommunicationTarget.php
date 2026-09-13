<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommunicationTarget extends Model
{
    public const ALL_FACULTIES = 'all_faculties';

    public const FACULTY = 'faculty';

    public const ALL_DEPARTMENTS = 'all_departments';

    public const DEPARTMENT = 'department';

    public const ALL_STAFF = 'all_staff';

    public const STAFF = 'staff';

    protected $fillable = [
        'communication_id',
        'target_type',
        'target_id',
        'target_label',
    ];

    public function communication(): BelongsTo
    {
        return $this->belongsTo(Communication::class);
    }
}
