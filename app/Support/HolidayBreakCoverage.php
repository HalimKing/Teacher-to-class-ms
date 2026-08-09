<?php

namespace App\Support;

use App\Models\Teacher;

class HolidayBreakCoverage
{
    public const ALL_STAFF = 'all_staff';
    public const ALL_ADMINISTRATORS = 'all_administrators';
    public const ALL_LECTURERS = 'all_lecturers';
    public const SELECTED_STAFF = 'selected_staff';
    public const SELECTED_ADMINISTRATORS = 'selected_administrators';
    public const SELECTED_LECTURERS = 'selected_lecturers';

    /**
     * @return array<string, string>
     */
    public static function labels(): array
    {
        return [
            self::ALL_STAFF => 'All Staff',
            self::ALL_ADMINISTRATORS => 'All Administrators (Non-Teaching Staff)',
            self::ALL_LECTURERS => 'All Lecturers (Teaching Staff)',
            self::SELECTED_STAFF => 'Selected Staff',
            self::SELECTED_ADMINISTRATORS => 'Selected Administrators',
            self::SELECTED_LECTURERS => 'Selected Lecturers',
        ];
    }

    public static function label(?string $coverage): string
    {
        return self::labels()[$coverage ?? ''] ?? 'All Staff';
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_keys(self::labels());
    }

    public static function requiresStaffSelection(?string $coverage): bool
    {
        return in_array($coverage, [
            self::SELECTED_STAFF,
            self::SELECTED_ADMINISTRATORS,
            self::SELECTED_LECTURERS,
        ], true);
    }

    public static function isAllCoverage(?string $coverage): bool
    {
        return in_array($coverage, [
            self::ALL_STAFF,
            self::ALL_ADMINISTRATORS,
            self::ALL_LECTURERS,
        ], true);
    }

    /**
     * Staff type filter for lists. Null means both types.
     */
    public static function staffTypeFilter(?string $coverage): ?string
    {
        return match ($coverage) {
            self::ALL_ADMINISTRATORS, self::SELECTED_ADMINISTRATORS => Teacher::STAFF_TYPE_ADMINISTRATOR,
            self::ALL_LECTURERS, self::SELECTED_LECTURERS => Teacher::STAFF_TYPE_LECTURER,
            default => null,
        };
    }

    public static function description(?string $coverage): string
    {
        return match ($coverage) {
            self::ALL_STAFF => 'This holiday/break suspends attendance for every staff member, unless they are assigned to break duty.',
            self::ALL_ADMINISTRATORS => 'Applies to all administrators (non-teaching staff). Lecturers keep their normal attendance schedule.',
            self::ALL_LECTURERS => 'Applies to all lecturers (teaching staff). Administrators keep their normal attendance schedule.',
            self::SELECTED_STAFF => 'Only the staff members you select are covered. Everyone else continues normal attendance.',
            self::SELECTED_ADMINISTRATORS => 'Only the selected administrators are covered. Other staff continue normal attendance.',
            self::SELECTED_LECTURERS => 'Only the selected lecturers are covered. Other staff continue normal attendance.',
            default => 'Choose who this holiday/break applies to.',
        };
    }
}
