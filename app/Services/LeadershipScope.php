<?php

namespace App\Services;

use App\Models\Teacher;
use App\Support\LeadershipAssignment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class LeadershipScope
{
    public function isLeader(?Teacher $teacher): bool
    {
        return $teacher instanceof Teacher && $teacher->hasLeadershipAssignment();
    }

    public function applyToTeachers(Builder $query, Teacher $leader): Builder
    {
        if ($leader->isDirectorDean() && $leader->leadership_faculty_id) {
            return $query->where('faculty_id', $leader->leadership_faculty_id);
        }

        if ($leader->isHeadOfDepartment() && $leader->leadership_department_id) {
            return $query->where('department_id', $leader->leadership_department_id);
        }

        return $query->whereRaw('1 = 0');
    }

    public function canManage(Teacher $actor, Teacher $target): bool
    {
        if ($actor->isDirectorDean() && $actor->leadership_faculty_id) {
            return (int) $target->faculty_id === (int) $actor->leadership_faculty_id;
        }

        if ($actor->isHeadOfDepartment() && $actor->leadership_department_id) {
            return (int) $target->department_id === (int) $actor->leadership_department_id;
        }

        return false;
    }

    public function constrainStaffOrganization(Teacher $leader, int $facultyId, int $departmentId): bool
    {
        if ($leader->isDirectorDean() && $leader->leadership_faculty_id) {
            return (int) $facultyId === (int) $leader->leadership_faculty_id;
        }

        if ($leader->isHeadOfDepartment() && $leader->leadership_department_id) {
            return (int) $departmentId === (int) $leader->leadership_department_id
                && (int) $facultyId === (int) $leader->leadership_faculty_id;
        }

        return false;
    }

    public function applyRequestScope(Request $request, Teacher $leader): void
    {
        if ($leader->isDirectorDean() && $leader->leadership_faculty_id) {
            $request->merge([
                'faculty' => $leader->leadership_faculty_id,
                'faculty_id' => $leader->leadership_faculty_id,
            ]);
        }

        if ($leader->isHeadOfDepartment() && $leader->leadership_department_id) {
            $request->merge([
                'faculty' => $leader->leadership_faculty_id,
                'faculty_id' => $leader->leadership_faculty_id,
                'department' => $leader->leadership_department_id,
                'department_id' => $leader->leadership_department_id,
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function summary(Teacher $teacher): array
    {
        return [
            'role' => $teacher->leadership_role,
            'role_label' => LeadershipAssignment::label($teacher->leadership_role),
            'faculty_id' => $teacher->leadership_faculty_id,
            'faculty_name' => $teacher->leadershipFaculty?->name,
            'department_id' => $teacher->leadership_department_id,
            'department_name' => $teacher->leadershipDepartment?->name,
        ];
    }
}
