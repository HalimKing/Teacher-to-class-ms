<?php

namespace App\Support;

use App\Models\StaffAttendance;
use App\Models\TeacherAttendance;

class SelfReportedAbsence
{
    public const KIND_LECTURER = 'lecturer';

    public const KIND_ADMINISTRATOR = 'administrator';

    /**
     * A staff member may self-report only when the session is still open:
     * not rescheduled away, not already taken, and not already locked absent.
     */
    public static function isPermitted(
        TeacherAttendance|StaffAttendance|null $attendance,
        bool $isMissed,
        bool $isRescheduledAway = false,
    ): bool {
        if ($isRescheduledAway || $isMissed) {
            return false;
        }

        if ($attendance === null) {
            return true;
        }

        if ($attendance->self_reported || $attendance->isAbsenceLocked()) {
            return false;
        }

        if ($attendance->check_in_time || $attendance->check_out_time) {
            return false;
        }

        return true;
    }
}
