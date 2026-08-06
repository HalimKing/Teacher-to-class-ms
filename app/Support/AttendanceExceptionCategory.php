<?php

namespace App\Support;

class AttendanceExceptionCategory
{
    public const NORMAL = 'normal';
    public const AUTHORIZED_VENUE_CHANGE = 'authorized_venue_change';
    public const EXCUSED_ABSENCE = 'excused_absence';
    public const UNEXCUSED_ABSENCE = 'unexcused_absence';
    public const AUTHORIZED_EARLY_DEPARTURE = 'authorized_early_departure';
    public const UNAUTHORIZED_EARLY_DEPARTURE = 'unauthorized_early_departure';

    public static function labels(): array
    {
        return [
            self::NORMAL => 'Normal attendance',
            self::AUTHORIZED_VENUE_CHANGE => 'Authorized venue change',
            self::EXCUSED_ABSENCE => 'Excused absence',
            self::UNEXCUSED_ABSENCE => 'Unexcused absence',
            self::AUTHORIZED_EARLY_DEPARTURE => 'Authorized early departure',
            self::UNAUTHORIZED_EARLY_DEPARTURE => 'Unauthorized early departure',
        ];
    }

    public static function label(?string $category): string
    {
        return self::labels()[$category ?? self::NORMAL] ?? 'Normal attendance';
    }
}
