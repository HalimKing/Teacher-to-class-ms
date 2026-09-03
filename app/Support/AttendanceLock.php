<?php

namespace App\Support;

class AttendanceLock
{
    public const MESSAGE = 'You have been marked absent for this session and can no longer check in or check out.';

    /**
     * Statuses that finalize a session. Once a record carries one of these the
     * session is closed: no further check-in or check-out may be recorded.
     */
    public const LOCKED_STATUSES = ['absent', 'excused_absence'];

    public static function isLocked(?string $status): bool
    {
        return $status !== null && in_array($status, self::LOCKED_STATUSES, true);
    }

    /**
     * @return array{success: false, message: string, state: string}
     */
    public static function blockedPayload(): array
    {
        return [
            'success' => false,
            'message' => self::MESSAGE,
            'state' => 'missed',
        ];
    }
}
