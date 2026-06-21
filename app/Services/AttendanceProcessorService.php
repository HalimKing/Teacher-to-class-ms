<?php

namespace App\Services;

use App\Models\RescheduledSession;
use App\Models\StaffAttendance;
use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Models\TeacherAttendance;
use App\Models\TimeTable;
use App\Support\AttendanceRecordSource;
use App\Support\LecturerNotificationPayload;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Facades\Log;

class AttendanceProcessorService
{
    private const TEACHER_TERMINAL_WITH_CHECKOUT = ['completed', 'late', 'early_leave', 'overtime'];

    private const STAFF_TERMINAL_WITH_CHECKOUT = ['completed', 'late', 'early_leave', 'overtime'];

    public function __construct(
        private AttendanceTimingService $timingService,
        private RescheduledAttendanceService $rescheduledAttendance,
        private LecturerNotificationService $notifications,
        private ActivityLogService $activityLog,
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

        $teacherAttendances = new EloquentCollection();
        $staffAttendances = new EloquentCollection();

        TimeTable::query()
            ->with(['course', 'teacher'])
            ->where('day_of_week', $dayOfWeek)
            ->whereIn('staff_type', [Teacher::STAFF_TYPE_LECTURER, Teacher::STAFF_TYPE_ADMINISTRATOR])
            ->chunkById(100, function (EloquentCollection $schedules) use (
                $now,
                $today,
                &$stats,
                &$teacherAttendances,
                &$staffAttendances,
            ) {
                $eligible = $schedules->filter(fn (TimeTable $schedule) => $this->shouldProcessSchedule($schedule, $now));

                if ($eligible->isEmpty()) {
                    return;
                }

                $lecturerScheduleIds = $eligible
                    ->where('staff_type', Teacher::STAFF_TYPE_LECTURER)
                    ->pluck('id');

                if ($lecturerScheduleIds->isNotEmpty()) {
                    $teacherAttendances = $teacherAttendances->merge(
                        TeacherAttendance::query()
                            ->whereDate('date', $today)
                            ->whereIn('timetable_id', $lecturerScheduleIds)
                            ->get()
                    );
                }

                $adminScheduleIds = $eligible
                    ->where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR)
                    ->pluck('id');

                if ($adminScheduleIds->isNotEmpty()) {
                    $staffAttendances = $staffAttendances->merge(
                        StaffAttendance::query()
                            ->whereDate('date', $today)
                            ->whereIn('timetable_id', $adminScheduleIds)
                            ->get()
                    );
                }

                foreach ($eligible as $schedule) {
                    if ($schedule->staff_type === Teacher::STAFF_TYPE_ADMINISTRATOR) {
                        $this->processAdministratorSchedule(
                            $schedule,
                            $today,
                            $now,
                            $stats['administrators'],
                            $staffAttendances,
                        );
                        continue;
                    }

                    if ($this->rescheduledAttendance->shouldSkipAutoAbsentForMovedSession($schedule, $now)) {
                        $stats['teachers']['skipped']++;
                        continue;
                    }

                    $this->processTeacherSchedule(
                        $schedule,
                        $today,
                        $now,
                        $stats['teachers'],
                        $teacherAttendances,
                        $this->rescheduledAttendance->resolveActiveRescheduleForDate($schedule, $now),
                    );
                }
            });

        RescheduledSession::query()
            ->approved()
            ->with(['timetable.course', 'timetable.teacher'])
            ->whereDate('new_date', $today)
            ->whereHas('timetable', fn ($query) => $query->whereIn('staff_type', [
                Teacher::STAFF_TYPE_LECTURER,
                Teacher::STAFF_TYPE_ADMINISTRATOR,
            ]))
            ->chunkById(50, function (EloquentCollection $sessions) use (
                $dayOfWeek,
                $now,
                $today,
                &$stats,
                &$teacherAttendances,
                &$staffAttendances,
            ) {
                $eligible = $sessions->filter(function (RescheduledSession $session) use ($dayOfWeek, $now) {
                    $schedule = $session->timetable;
                    if (!$schedule || $schedule->day_of_week === $dayOfWeek) {
                        return false;
                    }

                    return $this->shouldProcessRescheduledSession($session, $now);
                });

                if ($eligible->isEmpty()) {
                    return;
                }

                $lecturerTimetableIds = $eligible
                    ->filter(fn (RescheduledSession $session) => $session->timetable?->staff_type === Teacher::STAFF_TYPE_LECTURER)
                    ->pluck('timetable_id');

                if ($lecturerTimetableIds->isNotEmpty()) {
                    $teacherAttendances = $teacherAttendances->merge(
                        TeacherAttendance::query()
                            ->whereDate('date', $today)
                            ->whereIn('timetable_id', $lecturerTimetableIds)
                            ->get()
                    );
                }

                $adminTimetableIds = $eligible
                    ->filter(fn (RescheduledSession $session) => $session->timetable?->staff_type === Teacher::STAFF_TYPE_ADMINISTRATOR)
                    ->pluck('timetable_id');

                if ($adminTimetableIds->isNotEmpty()) {
                    $staffAttendances = $staffAttendances->merge(
                        StaffAttendance::query()
                            ->whereDate('date', $today)
                            ->whereIn('timetable_id', $adminTimetableIds)
                            ->get()
                    );
                }

                foreach ($eligible as $session) {
                    $schedule = $session->timetable;
                    if (!$schedule) {
                        continue;
                    }

                    if ($schedule->staff_type === Teacher::STAFF_TYPE_ADMINISTRATOR) {
                        $this->processAdministratorSchedule(
                            $schedule,
                            $today,
                            $now,
                            $stats['administrators'],
                            $staffAttendances,
                            $session,
                        );
                        continue;
                    }

                    $this->processTeacherSchedule(
                        $schedule,
                        $today,
                        $now,
                        $stats['teachers'],
                        $teacherAttendances,
                        $session,
                    );
                }
            });

        return $stats;
    }

    public function shouldProcessSchedule(TimeTable $schedule, Carbon $now): bool
    {
        if ($this->rescheduledAttendance->shouldSkipAutoAbsentForMovedSession($schedule, $now)) {
            return false;
        }

        $endTime = $this->rescheduledAttendance->resolveProcessorEndTime($schedule, $now);
        if (!$endTime) {
            return false;
        }

        $scheduledEnd = $this->timingService->parseScheduleTime($endTime, $now);

        return $this->timingService->hasCheckoutGraceExpired($now, $scheduledEnd);
    }

    public function shouldProcessRescheduledSession(RescheduledSession $session, Carbon $now): bool
    {
        if (!$session->new_end_time) {
            return false;
        }

        $scheduledEnd = $this->timingService->parseScheduleTime((string) $session->new_end_time, $now);

        return $this->timingService->hasCheckoutGraceExpired($now, $scheduledEnd);
    }

    private function processTeacherSchedule(
        TimeTable $schedule,
        string $today,
        Carbon $now,
        array &$stats,
        EloquentCollection $teacherAttendances,
        ?RescheduledSession $rescheduledSession = null,
    ): void {
        $stats['processed']++;

        $attendance = $this->findTeacherAttendance($teacherAttendances, $schedule, $rescheduledSession);

        if (!$attendance) {
            if ($this->shouldAutoMarkAbsent()) {
                $created = $this->createTeacherAbsentRecord($schedule, $today, $now, $rescheduledSession);
                if ($created) {
                    $teacherAttendances->push($created);
                    $stats['absent']++;
                } else {
                    $stats['skipped']++;
                }
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
            $this->finalizeTeacherCheckout($attendance, $schedule, $now, $rescheduledSession);
            $stats['finalized']++;
        }
    }

    private function processAdministratorSchedule(
        TimeTable $schedule,
        string $today,
        Carbon $now,
        array &$stats,
        EloquentCollection $staffAttendances,
        ?RescheduledSession $rescheduledSession = null,
    ): void {
        $stats['processed']++;

        $attendance = $this->findStaffAttendance($staffAttendances, $schedule);

        if (!$attendance) {
            if ($this->shouldAutoMarkAbsent()) {
                $created = $this->createStaffAbsentRecord($schedule, $today, $now, $rescheduledSession);
                if ($created) {
                    $staffAttendances->push($created);
                    $stats['absent']++;
                } else {
                    $stats['skipped']++;
                }
            } else {
                $stats['skipped']++;
            }

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
            $this->finalizeStaffCheckout($attendance, $schedule, $now, $rescheduledSession);
            $stats['finalized']++;
        }
    }

    private function createTeacherAbsentRecord(
        TimeTable $schedule,
        string $today,
        Carbon $now,
        ?RescheduledSession $rescheduledSession = null,
    ): ?TeacherAttendance {
        $attributes = [
            'teacher_id' => $schedule->teacher_id,
            'timetable_id' => $schedule->id,
            'rescheduled_session_id' => $rescheduledSession?->id,
            'date' => $today,
        ];

        $existing = TeacherAttendance::query()->where($attributes)->first();
        if ($existing) {
            return null;
        }

        try {
            $attendance = TeacherAttendance::create([
                ...$attributes,
                'classroom_id' => $rescheduledSession?->classroom_id ?? $schedule->class_room_id,
                'academic_year_id' => $schedule->academic_year_id,
                'course_id' => $schedule->course_id,
                'status' => 'absent',
                'attendance_source' => AttendanceRecordSource::SYSTEM,
                'auto_generated' => true,
                'auto_generated_at' => $now,
                'auto_absence_reason' => AttendanceRecordSource::REASON_SESSION_EXPIRED,
            ]);
        } catch (\Throwable $exception) {
            Log::warning('Skipped duplicate teacher auto-absence record.', [
                'timetable_id' => $schedule->id,
                'teacher_id' => $schedule->teacher_id,
                'date' => $today,
                'error' => $exception->getMessage(),
            ]);

            return null;
        }

        $this->logAutoAbsence($attendance, $schedule, $now, Teacher::STAFF_TYPE_LECTURER);
        $this->notifyTeacherAutoAbsence($schedule, $today);

        return $attendance;
    }

    private function createStaffAbsentRecord(
        TimeTable $schedule,
        string $today,
        Carbon $now,
        ?RescheduledSession $rescheduledSession = null,
    ): ?StaffAttendance {
        $attributes = [
            'staff_id' => $schedule->teacher_id,
            'timetable_id' => $schedule->id,
            'date' => $today,
        ];

        $existing = StaffAttendance::query()->where($attributes)->first();
        if ($existing) {
            return null;
        }

        try {
            $attendance = StaffAttendance::create([
                ...$attributes,
                'classroom_id' => $rescheduledSession?->classroom_id ?? $schedule->class_room_id,
                'academic_year_id' => $schedule->academic_year_id,
                'attendance_status' => 'absent',
                'attendance_source' => AttendanceRecordSource::SYSTEM,
                'auto_generated' => true,
                'auto_generated_at' => $now,
                'auto_absence_reason' => AttendanceRecordSource::REASON_SESSION_EXPIRED,
            ]);
        } catch (\Throwable $exception) {
            Log::warning('Skipped duplicate administrator auto-absence record.', [
                'timetable_id' => $schedule->id,
                'staff_id' => $schedule->teacher_id,
                'date' => $today,
                'error' => $exception->getMessage(),
            ]);

            return null;
        }

        $this->logAutoAbsence($attendance, $schedule, $now, Teacher::STAFF_TYPE_ADMINISTRATOR);
        $this->notifyAdministratorAutoAbsence($schedule, $today);

        return $attendance;
    }

    private function logAutoAbsence(
        TeacherAttendance|StaffAttendance $attendance,
        TimeTable $schedule,
        Carbon $now,
        string $staffType,
    ): void {
        $person = $schedule->teacher;
        $personName = trim(($person?->first_name ?? '') . ' ' . ($person?->last_name ?? '')) ?: 'Unknown staff member';
        $roleLabel = $staffType === Teacher::STAFF_TYPE_ADMINISTRATOR ? 'administrator' : 'lecturer';

        $this->activityLog->logAttendance(
            eventType: 'auto_absence_recorded',
            description: "System marked {$roleLabel} {$personName} absent for session on {$attendance->date?->format('Y-m-d')}.",
            metadata: [
                'staff_type' => $staffType,
                'teacher_id' => $schedule->teacher_id,
                'timetable_id' => $schedule->id,
                'attendance_id' => $attendance->id,
                'attendance_date' => $attendance->date?->format('Y-m-d'),
                'action_type' => 'auto_absence',
                'auto_generated' => true,
                'reason' => AttendanceRecordSource::REASON_SESSION_EXPIRED,
                'processed_at' => $now->toDateTimeString(),
            ],
        );

        Log::info('Auto absence recorded.', [
            'staff_type' => $staffType,
            'teacher_id' => $schedule->teacher_id,
            'timetable_id' => $schedule->id,
            'attendance_id' => $attendance->id,
            'date' => $attendance->date?->format('Y-m-d'),
            'reason' => AttendanceRecordSource::REASON_SESSION_EXPIRED,
        ]);
    }

    private function notifyTeacherAutoAbsence(TimeTable $schedule, string $today): void
    {
        $teacher = $schedule->teacher;
        if (!$teacher) {
            return;
        }

        $courseName = $schedule->course?->name ?? 'your scheduled session';

        $this->notifications->notify($teacher, LecturerNotificationPayload::make(
            type: 'auto_absence_recorded',
            category: LecturerNotificationPayload::CATEGORY_ATTENDANCE,
            priority: LecturerNotificationPayload::PRIORITY_HIGH,
            title: 'Automatic Absence Recorded',
            message: "You were marked absent for {$courseName} because attendance was not completed before the attendance window expired.",
            url: '/teacher/attendance',
            meta: [
                'timetable_id' => $schedule->id,
                'date' => $today,
                'reason' => AttendanceRecordSource::REASON_SESSION_EXPIRED,
            ],
        ));
    }

    private function notifyAdministratorAutoAbsence(TimeTable $schedule, string $today): void
    {
        $administrator = $schedule->teacher;
        if (!$administrator) {
            return;
        }

        $this->notifications->notify($administrator, LecturerNotificationPayload::make(
            type: 'auto_absence_recorded',
            category: LecturerNotificationPayload::CATEGORY_ATTENDANCE,
            priority: LecturerNotificationPayload::PRIORITY_HIGH,
            title: 'Automatic Absence Recorded',
            message: 'You were marked absent because your attendance session expired without a successful check-in.',
            url: '/teacher/staff-attendance',
            meta: [
                'timetable_id' => $schedule->id,
                'date' => $today,
                'reason' => AttendanceRecordSource::REASON_SESSION_EXPIRED,
            ],
        ));
    }

    private function findTeacherAttendance(
        EloquentCollection $teacherAttendances,
        TimeTable $schedule,
        ?RescheduledSession $rescheduledSession = null,
    ): ?TeacherAttendance {
        return $teacherAttendances->first(function (TeacherAttendance $attendance) use ($schedule, $rescheduledSession) {
            if ((int) $attendance->timetable_id !== (int) $schedule->id) {
                return false;
            }

            $expectedRescheduledId = $rescheduledSession?->id;

            return (int) ($attendance->rescheduled_session_id ?? 0) === (int) ($expectedRescheduledId ?? 0);
        });
    }

    private function findStaffAttendance(EloquentCollection $staffAttendances, TimeTable $schedule): ?StaffAttendance
    {
        return $staffAttendances->first(
            fn (StaffAttendance $attendance) => (int) $attendance->timetable_id === (int) $schedule->id
                && (int) $attendance->staff_id === (int) $schedule->teacher_id
        );
    }

    private function finalizeTeacherCheckout(
        TeacherAttendance $attendance,
        TimeTable $schedule,
        Carbon $now,
        ?RescheduledSession $rescheduledSession = null,
    ): void {
        if (in_array($attendance->status, self::TEACHER_TERMINAL_WITH_CHECKOUT, true)) {
            return;
        }

        $endTime = $rescheduledSession?->new_end_time
            ?? $this->rescheduledAttendance->resolveProcessorEndTime($schedule, Carbon::parse($attendance->date))
            ?? $schedule->end_time;
        $scheduledEnd = $this->timingService->parseScheduleTime((string) $endTime, $now);
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

    private function finalizeStaffCheckout(
        StaffAttendance $attendance,
        TimeTable $schedule,
        Carbon $now,
        ?RescheduledSession $rescheduledSession = null,
    ): void {
        if (in_array($attendance->attendance_status, self::STAFF_TERMINAL_WITH_CHECKOUT, true)) {
            return;
        }

        $endTime = $rescheduledSession?->new_end_time ?? $schedule->end_time;
        $scheduledEnd = $this->timingService->parseScheduleTime((string) $endTime, $now);
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
        if (in_array($attendance->attendance_status, ['absent', 'incomplete'], true)) {
            return true;
        }

        if (!$attendance->check_out_time) {
            return false;
        }

        return in_array($attendance->attendance_status, self::STAFF_TERMINAL_WITH_CHECKOUT, true);
    }

    private function shouldAutoMarkAbsent(): bool
    {
        return (bool) SystemSetting::getValue('auto_mark_absent_after_end', true);
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
