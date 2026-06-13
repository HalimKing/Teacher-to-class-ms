<?php

namespace App\Services;

use App\Models\SystemSetting;
use Carbon\Carbon;

class AttendanceTimingService
{
    public const ROLE_TEACHER = 'teacher';

    public const ROLE_ADMINISTRATOR = 'administrator';

    public function getEarlyCheckInMinutes(string $role = self::ROLE_ADMINISTRATOR): int
    {
        $key = $role === self::ROLE_TEACHER
            ? 'teacher_early_checkin_minutes'
            : 'administrator_early_checkin_minutes';

        $minutes = (int) SystemSetting::getValue($key, 30);

        return max(0, min($minutes, 180));
    }

    public function getCheckoutGracePeriodMinutes(): int
    {
        $minutes = (int) SystemSetting::getValue('checkout_grace_period_minutes', 30);

        return max(0, min($minutes, 180));
    }

    public function getLateCheckInMinutes(): int
    {
        return max(0, (int) SystemSetting::getValue('late_check_in_minutes', 15));
    }

    public function getEarlyLeaveMinutes(): int
    {
        return max(0, (int) SystemSetting::getValue('early_leave_minutes', 15));
    }

    public function parseScheduleTime(string $time, ?Carbon $reference = null): Carbon
    {
        $reference ??= now();
        $normalized = strlen($time) === 5 ? "{$time}:00" : $time;

        return Carbon::createFromFormat('Y-m-d H:i:s', $reference->format('Y-m-d') . ' ' . $normalized);
    }

    public function parseAttendanceTime(string $time, ?Carbon $reference = null): Carbon
    {
        $reference ??= now();
        $normalized = trim($time);
        $datePrefix = $reference->format('Y-m-d');

        foreach (['H:i:s', 'H:i', 'g:i A', 'h:i A'] as $format) {
            try {
                return Carbon::createFromFormat('Y-m-d ' . $format, $datePrefix . ' ' . $normalized);
            } catch (\Throwable) {
                continue;
            }
        }

        return Carbon::parse($datePrefix . ' ' . $normalized);
    }

    public function getAllowedCheckInTime(Carbon $scheduledStart, string $role = self::ROLE_ADMINISTRATOR): Carbon
    {
        return $scheduledStart->copy()->subMinutes($this->getEarlyCheckInMinutes($role));
    }

    public function getCheckoutGraceDeadline(Carbon $scheduledEnd): Carbon
    {
        return $scheduledEnd->copy()->addMinutes($this->getCheckoutGracePeriodMinutes());
    }

    public function canCheckInNow(Carbon $now, Carbon $scheduledStart, string $role = self::ROLE_ADMINISTRATOR): bool
    {
        return $now->greaterThanOrEqualTo($this->getAllowedCheckInTime($scheduledStart, $role));
    }

    public function canCheckOutAfterEnd(Carbon $now, Carbon $scheduledEnd): bool
    {
        return $now->greaterThanOrEqualTo($scheduledEnd);
    }

    public function isWithinCheckoutGrace(Carbon $now, Carbon $scheduledEnd): bool
    {
        return $now->greaterThanOrEqualTo($scheduledEnd)
            && $now->lessThanOrEqualTo($this->getCheckoutGraceDeadline($scheduledEnd));
    }

    public function resolveCheckInOutcome(Carbon $now, Carbon $scheduledStart, string $role = self::ROLE_ADMINISTRATOR): array
    {
        $lateMinutes = $this->getLateCheckInMinutes();
        $lateThreshold = $scheduledStart->copy()->addMinutes($lateMinutes);
        $checkedInStatus = $role === self::ROLE_TEACHER ? 'pending' : 'checked_in';

        if ($now->gt($lateThreshold)) {
            return [
                'attendance_status' => 'late',
                'arrival_category' => 'late',
                'minutes_early' => null,
                'minutes_late' => $scheduledStart->diffInMinutes($now),
            ];
        }

        if ($now->lt($scheduledStart)) {
            return [
                'attendance_status' => $checkedInStatus,
                'arrival_category' => 'early',
                'minutes_early' => $now->diffInMinutes($scheduledStart),
                'minutes_late' => null,
            ];
        }

        return [
            'attendance_status' => $checkedInStatus,
            'arrival_category' => 'on_time',
            'minutes_early' => null,
            'minutes_late' => null,
        ];
    }

    public function resolveCheckOutOutcome(Carbon $now, Carbon $scheduledEnd, ?string $checkInStatus = null, string $role = self::ROLE_ADMINISTRATOR): array
    {
        $earlyLeaveThreshold = $scheduledEnd->copy()->subMinutes($this->getEarlyLeaveMinutes());
        $graceDeadline = $this->getCheckoutGraceDeadline($scheduledEnd);
        $completedStatus = $role === self::ROLE_TEACHER ? 'completed' : 'completed';

        if ($now->lt($earlyLeaveThreshold)) {
            return [
                'attendance_status' => 'early_leave',
                'departure_category' => 'early_leave',
                'minutes_overtime' => null,
            ];
        }

        if ($now->lt($scheduledEnd)) {
            return [
                'attendance_status' => 'early_leave',
                'departure_category' => 'early_leave',
                'minutes_overtime' => null,
            ];
        }

        if ($now->lte($graceDeadline)) {
            $status = $checkInStatus === 'late' ? 'late' : $completedStatus;

            return [
                'attendance_status' => $status,
                'departure_category' => 'on_time',
                'minutes_overtime' => null,
            ];
        }

        $status = $checkInStatus === 'late' ? 'late' : 'overtime';

        return [
            'attendance_status' => $status,
            'departure_category' => 'overtime',
            'minutes_overtime' => $graceDeadline->diffInMinutes($now),
        ];
    }

    public function buildScheduleTiming(?string $startTime, ?string $endTime = null, ?Carbon $reference = null, string $role = self::ROLE_ADMINISTRATOR): array
    {
        $reference ??= now();
        $earlyMinutes = $this->getEarlyCheckInMinutes($role);
        $graceMinutes = $this->getCheckoutGracePeriodMinutes();

        if (!$startTime) {
            return $this->emptyScheduleTiming($earlyMinutes, $graceMinutes);
        }

        $scheduledStart = $this->parseScheduleTime($startTime, $reference);
        $allowedCheckIn = $this->getAllowedCheckInTime($scheduledStart, $role);
        $canCheckIn = $this->canCheckInNow($reference, $scheduledStart, $role);
        $minutesUntilOpen = $canCheckIn ? 0 : $allowedCheckIn->diffInMinutes($reference);

        $timing = [
            'early_checkin_minutes' => $earlyMinutes,
            'checkout_grace_period_minutes' => $graceMinutes,
            'scheduled_start_time' => $scheduledStart->format('H:i:s'),
            'scheduled_start_time_display' => $scheduledStart->format('h:i A'),
            'allowed_check_in_time' => $allowedCheckIn->format('H:i:s'),
            'allowed_check_in_time_display' => $allowedCheckIn->format('h:i A'),
            'can_check_in_now' => $canCheckIn,
            'minutes_until_check_in_opens' => $canCheckIn ? 0 : $minutesUntilOpen,
            'attendance_opens_message' => $canCheckIn
                ? null
                : 'Attendance opens at ' . $allowedCheckIn->format('h:i A'),
            'scheduled_end_time' => null,
            'scheduled_end_time_display' => null,
            'checkout_grace_deadline' => null,
            'checkout_grace_deadline_display' => null,
            'can_check_out_now' => false,
            'is_within_checkout_grace' => false,
            'is_after_checkout_grace' => false,
            'checkout_opens_message' => null,
        ];

        if ($endTime) {
            $scheduledEnd = $this->parseScheduleTime($endTime, $reference);
            $graceDeadline = $this->getCheckoutGraceDeadline($scheduledEnd);
            $canCheckOut = $this->canCheckOutAfterEnd($reference, $scheduledEnd);
            $withinGrace = $this->isWithinCheckoutGrace($reference, $scheduledEnd);

            $timing['scheduled_end_time'] = $scheduledEnd->format('H:i:s');
            $timing['scheduled_end_time_display'] = $scheduledEnd->format('h:i A');
            $timing['checkout_grace_deadline'] = $graceDeadline->format('H:i:s');
            $timing['checkout_grace_deadline_display'] = $graceDeadline->format('h:i A');
            $timing['can_check_out_now'] = $canCheckOut;
            $timing['is_within_checkout_grace'] = $withinGrace;
            $timing['is_after_checkout_grace'] = $reference->gt($graceDeadline);
            $timing['checkout_opens_message'] = $canCheckOut
                ? null
                : 'Check-out opens at ' . $scheduledEnd->format('h:i A');
            $timing['checkout_grace_message'] = $withinGrace
                ? 'Check-out grace period ends at ' . $graceDeadline->format('h:i A')
                : ($reference->gt($graceDeadline)
                    ? 'Check-out is past the grace period and will be recorded as overtime'
                    : null);
        }

        return $timing;
    }

    public function hasCheckoutGraceExpired(Carbon $now, Carbon $scheduledEnd): bool
    {
        return $now->greaterThan($this->getCheckoutGraceDeadline($scheduledEnd));
    }

    public function formatArrivalCategory(?string $category): string
    {
        return match ($category) {
            'early' => 'Early',
            'on_time' => 'On Time',
            'late' => 'Late',
            default => 'Unknown',
        };
    }

    public function formatDepartureCategory(?string $category): string
    {
        return match ($category) {
            'early_leave' => 'Early Leave',
            'on_time' => 'On Time',
            'overtime' => 'Overtime',
            default => 'Unknown',
        };
    }

    public function resolveArrivalForRecord(
        ?string $arrivalCategory,
        ?int $minutesEarly,
        ?int $minutesLate,
        ?string $checkInTime,
        ?string $scheduleStartTime,
        ?Carbon $date = null,
        string $role = self::ROLE_ADMINISTRATOR
    ): array {
        if ($arrivalCategory) {
            return [
                'arrival_category' => $arrivalCategory,
                'arrival_category_label' => $this->formatArrivalCategory($arrivalCategory),
                'minutes_early' => $minutesEarly,
                'minutes_late' => $minutesLate,
                'early_check_in' => $arrivalCategory === 'early',
            ];
        }

        if (!$checkInTime || !$scheduleStartTime) {
            return [
                'arrival_category' => null,
                'arrival_category_label' => 'Unknown',
                'minutes_early' => null,
                'minutes_late' => null,
                'early_check_in' => false,
            ];
        }

        $date ??= now();
        $checkIn = $this->parseAttendanceTime($checkInTime, $date);
        $scheduledStart = $this->parseScheduleTime($scheduleStartTime, $date);
        $outcome = $this->resolveCheckInOutcome($checkIn, $scheduledStart, $role);

        return [
            'arrival_category' => $outcome['arrival_category'],
            'arrival_category_label' => $this->formatArrivalCategory($outcome['arrival_category']),
            'minutes_early' => $outcome['minutes_early'],
            'minutes_late' => $outcome['minutes_late'],
            'early_check_in' => $outcome['arrival_category'] === 'early',
        ];
    }

    public function resolveDepartureForRecord(
        ?string $departureCategory,
        ?int $minutesOvertime,
        ?string $checkOutTime,
        ?string $scheduleEndTime,
        ?Carbon $date = null,
        ?string $checkInStatus = null,
        string $role = self::ROLE_ADMINISTRATOR
    ): array {
        if ($departureCategory) {
            return [
                'departure_category' => $departureCategory,
                'departure_category_label' => $this->formatDepartureCategory($departureCategory),
                'minutes_overtime' => $minutesOvertime,
                'is_overtime' => $departureCategory === 'overtime',
            ];
        }

        if (!$checkOutTime || !$scheduleEndTime) {
            return [
                'departure_category' => null,
                'departure_category_label' => 'Unknown',
                'minutes_overtime' => null,
                'is_overtime' => false,
            ];
        }

        $date ??= now();
        $checkOut = $this->parseAttendanceTime($checkOutTime, $date);
        $scheduledEnd = $this->parseScheduleTime($scheduleEndTime, $date);
        $outcome = $this->resolveCheckOutOutcome($checkOut, $scheduledEnd, $checkInStatus, $role);

        return [
            'departure_category' => $outcome['departure_category'],
            'departure_category_label' => $this->formatDepartureCategory($outcome['departure_category']),
            'minutes_overtime' => $outcome['minutes_overtime'],
            'is_overtime' => $outcome['departure_category'] === 'overtime',
        ];
    }

    private function emptyScheduleTiming(int $earlyMinutes, int $graceMinutes): array
    {
        return [
            'early_checkin_minutes' => $earlyMinutes,
            'checkout_grace_period_minutes' => $graceMinutes,
            'scheduled_start_time' => null,
            'allowed_check_in_time' => null,
            'can_check_in_now' => false,
            'minutes_until_check_in_opens' => null,
            'attendance_opens_message' => null,
            'scheduled_end_time' => null,
            'checkout_grace_deadline' => null,
            'can_check_out_now' => false,
            'is_within_checkout_grace' => false,
            'is_after_checkout_grace' => false,
            'checkout_opens_message' => null,
            'checkout_grace_message' => null,
        ];
    }
}
