<?php

namespace App\Support;

class VenueChangeApprovalRole
{
    public const DIRECTOR_DEAN = LeadershipAssignment::DIRECTOR_DEAN;

    public const HEAD_OF_DEPARTMENT = LeadershipAssignment::HEAD_OF_DEPARTMENT;

    public const ADMINISTRATOR = 'administrator';

    public const LABELS = [
        self::DIRECTOR_DEAN => 'Director/Dean',
        self::HEAD_OF_DEPARTMENT => 'Head of Department',
        self::ADMINISTRATOR => 'Administrator',
    ];

    public static function label(?string $role): string
    {
        if (!$role) {
            return 'Approver';
        }

        return self::LABELS[$role] ?? ucfirst(str_replace('_', ' ', $role));
    }

    public static function isLeadership(string $role): bool
    {
        return in_array($role, [self::DIRECTOR_DEAN, self::HEAD_OF_DEPARTMENT], true);
    }
}
