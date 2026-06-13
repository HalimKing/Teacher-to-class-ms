<?php

namespace App\Services;

use App\Models\StaffAttendance;
use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Models\TeacherAttendance;
use App\Models\TimeTable;
use Carbon\Carbon;

class AttendanceProcessorService
{
    private const TEACHER_TERMINAL_WITH_CHECKOUT = ['completed', 'late', 'early_leave', 'overtime'];

    private const STAFF_TERMINAL_WITH_CHECKOUT = ['completed', 'late', 'early_leave', 'overtime'];

    public function __construct(
        private AttendanceTimingService $timingService
    ) {}

    public function process(?Carbon $reference = null): array
    {
        $now = $reference ?? now();
        $today = $now->toDateString();
        $dayOfWeek = $now->format('l');

        $stats = [
            'teachers' => $this->emptyStats(),
            'administrators' => $this->emptyStats(),
        ];

        $schedules = TimeTable::query()
            ->with('course')
            ->where('day_of_week', $dayOfWeek)
            ->whereIn('staff_type', [Teacher::STAFF_TYPE_LECTURER, Teacher::STAFF_TYPE_ADMINISTRATOR])
            ->get()
            ->filter(fn (TimeTable $schedule) => $this->shouldProcessSchedule($schedule, $now));

        foreach ($schedules as $schedule) {
            if ($schedule->staff_type === Teacher::STAFF_TYPE_ADMINISTRATOR) {
                $this->processAdministratorSchedule($schedule, $today, $now, $stats['administrators']);
                continue;
            }

            $this->processTeacherSchedule($schedule, $today, $now, $stats['teachers']);
        }

        return $stats;
    }

    public function shouldProcessSchedule(TimeTable $schedule, Carbon $now): bool
    {
        if (!$schedule->end_time) {
            return false;
        }

        $scheduledEnd = $this->timingService->parseScheduleTime((string) $schedule->end_time, $now);

        return $this->timingService->hasCheckoutGraceExpired($now, $scheduledEnd);
    }

    private function processTeacherSchedule(TimeTable $schedule, string $today, Carbon $now, array &$stats): void
    {
        $stats['processed']++;

        $attendance = TeacherAttendance::query()
            ->where('timetable_id', $schedule->id)
            ->whereDate('date', $today)
            ->first();

        if (!$attendance) {
            if ($this->shouldAutoMarkAbsent()) {
                TeacherAttendance::create([
                    'teacher_id' => $schedule->teacher_id,
                    'timetable_id' => $schedule->id,
                    'classroom_id' => $schedule->class_room_id,
                    'academic_year_id' => $schedule->academic_year_id,
                    'course_id' => $schedule->course_id,
                    'date' => $today,
                    'status' => 'absent',
                ]);
                $stats['absent']++;
            } else {
                $stats['skipped']++;
            }

            return;
        }

        if ($this->isTeacherTerminal($attendance)) {
            $stats['skipped']++;
            return;
        }

        if ($attendance->check_in_time && !$attendance->check_out_time) {
            $attendance->update(['status' => 'incomplete']);
            $stats['incomplete']++;
            return;
        }

        if ($attendance->check_in_time && $attendance->check_out_time) {
            $this->finalizeTeacherCheckout($attendance, $schedule, $now);
            $stats['finalized']++;
        }
    }

    private function processAdministratorSchedule(TimeTable $schedule, string $today, Carbon $now, array &$stats): void
    {
        $stats['processed']++;

        $attendance = StaffAttendance::query()
            ->where('staff_id', $schedule->teacher_id)
            ->where('timetable_id', $schedule->id)
            ->whereDate('date', $today)
            ->first();

        if (!$attendance) {
            $stats['skipped']++;
            return;
        }

        if ($this->isStaffTerminal($attendance)) {
            $stats['skipped']++;
            return;
        }

        if ($attendance->check_in_time && !$attendance->check_out_time) {
            $attendance->update(['attendance_status' => 'incomplete']);
            $stats['incomplete']++;
            return;
        }

        if ($attendance->check_in_time && $attendance->check_out_time) {
            $this->finalizeStaffCheckout($attendance, $schedule, $now);
            $stats['finalized']++;
        }
    }

    private function finalizeTeacherCheckout(TeacherAttendance $attendance, TimeTable $schedule, Carbon $now): void
    {
        if (in_array($attendance->status, self::TEACHER_TERMINAL_WITH_CHECKOUT, true)) {
            return;
        }

        $scheduledEnd = $this->timingService->parseScheduleTime((string) $schedule->end_time, $now);
        $checkOut = $this->timingService->parseAttendanceTime((string) $attendance->check_out_time, $now);
        $outcome = $this->timingService->resolveCheckOutOutcome(
            $checkOut,
            $scheduledEnd,
            $attendance->status,
            AttendanceTimingService::ROLE_TEACHER
        );

        $attendance->update([
            'status' => $outcome['attendance_status'],
            'departure_category' => $outcome['departure_category'],
            'minutes_overtime' => $outcome['minutes_overtime'],
        ]);
    }

    private function finalizeStaffCheckout(StaffAttendance $attendance, TimeTable $schedule, Carbon $now): void
    {
        if (in_array($attendance->attendance_status, self::STAFF_TERMINAL_WITH_CHECKOUT, true)) {
            return;
        }

        $scheduledEnd = $this->timingService->parseScheduleTime((string) $schedule->end_time, $now);
        $checkOut = $this->timingService->parseAttendanceTime((string) $attendance->check_out_time, $now);
        $outcome = $this->timingService->resolveCheckOutOutcome(
            $checkOut,
            $scheduledEnd,
            $attendance->attendance_status,
            AttendanceTimingService::ROLE_ADMINISTRATOR
        );

        $attendance->update([
            'attendance_status' => $outcome['attendance_status'],
            'departure_category' => $outcome['departure_category'],
            'minutes_overtime' => $outcome['minutes_overtime'],
        ]);
    }

    private function isTeacherTerminal(TeacherAttendance $attendance): bool
    {
        if (in_array($attendance->status, ['absent', 'incomplete'], true)) {
            return true;
        }

        if (!$attendance->check_out_time) {
            return false;
        }

        return in_array($attendance->status, self::TEACHER_TERMINAL_WITH_CHECKOUT, true);
    }

    private function isStaffTerminal(StaffAttendance $attendance): bool
    {
        if ($attendance->attendance_status === 'incomplete') {
            return true;
        }

        if (!$attendance->check_out_time) {
            return false;
        }

        return in_array($attendance->attendance_status, self::STAFF_TERMINAL_WITH_CHECKOUT, true);
    }

    private function shouldAutoMarkAbsent(): bool
    {
        return (bool) SystemSetting::getValue('auto_mark_absent_after_end', false);
    }

    private function emptyStats(): array
    {
        return [
            'processed' => 0,
            'absent' => 0,
            'incomplete' => 0,
            'finalized' => 0,
            'skipped' => 0,
        ];
    }
}
