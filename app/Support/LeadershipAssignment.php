<?php

namespace App\Support;

use App\Models\Department;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class LeadershipAssignment
{
    public const DIRECTOR_DEAN = 'director_dean';

    public const HEAD_OF_DEPARTMENT = 'head_of_department';

    public const ROLES = [
        self::DIRECTOR_DEAN,
        self::HEAD_OF_DEPARTMENT,
    ];

    public const LABELS = [
        self::DIRECTOR_DEAN => 'Director/Dean',
        self::HEAD_OF_DEPARTMENT => 'Head of Department',
    ];

    /**
     * @return array<string, mixed>
     */
    public static function rules(): array
    {
        return [
            'leadershipRole' => ['nullable', 'string', Rule::in([...self::ROLES, ''])],
            'leadershipFaculty' => [
                'nullable',
                'required_if:leadershipRole,'.self::DIRECTOR_DEAN,
                'exists:faculties,id',
            ],
            'leadershipDepartment' => [
                'nullable',
                'required_if:leadershipRole,'.self::HEAD_OF_DEPARTMENT,
                'exists:departments,id',
            ],
        ];
    }

    /**
     * @return array{0: ?string, 1: ?int, 2: ?int}
     */
    public static function normalize(?string $role, mixed $facultyId, mixed $departmentId): array
    {
        $role = filled($role) ? (string) $role : null;

        if (! in_array($role, self::ROLES, true)) {
            return [null, null, null];
        }

        if ($role === self::DIRECTOR_DEAN) {
            return [self::DIRECTOR_DEAN, $facultyId ? (int) $facultyId : null, null];
        }

        $department = $departmentId ? Department::query()->find($departmentId) : null;

        if (! $department) {
            throw ValidationException::withMessages([
                'leadershipDepartment' => 'Select a valid department for this Head of Department assignment.',
            ]);
        }

        if ($facultyId && (int) $department->faculty_id !== (int) $facultyId) {
            throw ValidationException::withMessages([
                'leadershipDepartment' => 'The selected department does not belong to the selected Directorate/Faculty.',
            ]);
        }

        return [self::HEAD_OF_DEPARTMENT, (int) $department->faculty_id, (int) $department->id];
    }

    public static function label(?string $role): ?string
    {
        if (! $role) {
            return null;
        }

        return self::LABELS[$role] ?? null;
    }
}
