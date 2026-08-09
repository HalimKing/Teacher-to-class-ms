<?php

namespace App\Support;

class HolidayBreakType
{
    public const PUBLIC_HOLIDAY = 'public_holiday';
    public const UNIVERSITY_HOLIDAY = 'university_holiday';
    public const SEMESTER_BREAK = 'semester_break';
    public const CHRISTMAS_BREAK = 'christmas_break';
    public const EASTER_BREAK = 'easter_break';
    public const LONG_VACATION = 'long_vacation';
    public const OTHER_BREAK = 'other_break';

    /**
     * @return array<string, string>
     */
    public static function labels(): array
    {
        return [
            self::PUBLIC_HOLIDAY => 'Public Holiday',
            self::UNIVERSITY_HOLIDAY => 'University Holiday',
            self::SEMESTER_BREAK => 'Semester Break',
            self::CHRISTMAS_BREAK => 'Christmas Break',
            self::EASTER_BREAK => 'Easter Break',
            self::LONG_VACATION => 'Long Vacation',
            self::OTHER_BREAK => 'Other Break',
        ];
    }

    public static function label(?string $type): string
    {
        return self::labels()[$type ?? ''] ?? 'Other Break';
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_keys(self::labels());
    }

    public static function isPublicHoliday(?string $type): bool
    {
        return $type === self::PUBLIC_HOLIDAY;
    }
}
