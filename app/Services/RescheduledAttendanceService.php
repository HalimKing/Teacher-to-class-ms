<?php

namespace App\Services;

use App\Models\ClassRoom;
use App\Models\RescheduledSession;
use App\Models\TeacherAttendance;
use App\Models\TimeTable;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class RescheduledAttendanceService
{
    public const STATE_NORMAL = 'normal';
    public const STATE_RESCHEDULED_AWAY = 'rescheduled_away';
    public const STATE_RESCHEDULED_ACTIVE = 'rescheduled_active';

    public function __construct(
        private AttendanceTimingService $timingService,
    ) {}

    /**
     * @return array{
     *     moved_away: Collection<int, RescheduledSession>,
     *     active_today: Collection<int, RescheduledSession>,
     * }
     */
    public function loadTeacherRescheduleContext(int $teacherId, Carbon $date): array
    {
        $dateString = $date->toDateString();
        $todayTimetableIds = TimeTable::query()
            ->where('teacher_id', $teacherId)
            ->where('staff_type', \App\Models\Teacher::STAFF_TYPE_LECTURER)
            ->where('day_of_week', $date->format('l'))
            ->pluck('id');

        $sessions = RescheduledSession::query()
            ->with(['timetable.course', 'timetable.classRoom', 'classroom', 'approver:id,name'])
            ->where('teacher_id', $teacherId)
            ->whereIn('status', RescheduledSession::approvedStatuses())
            ->where(function ($query) use ($dateString, $todayTimetableIds) {
                $query->whereDate('original_date', $dateString)
                    ->orWhereDate('new_date', $dateString);

                if ($todayTimetableIds->isNotEmpty()) {
                    $query->orWhereIn('timetable_id', $todayTimetableIds);
                }
            })
            ->get();

        return [
            'moved_away' => $sessions
                ->filter(function (RescheduledSession $session) use ($dateString) {
                    if (!$session->timetable) {
                        return false;
                    }

                    return $this->effectiveOriginalDate($session, $session->timetable) === $dateString;
                })
                ->keyBy('timetable_id'),
            'active_today' => $sessions
                ->filter(fn (RescheduledSession $session) => $this->matchesDate($session->new_date, $dateString))
                ->keyBy('timetable_id'),
        ];
    }

    public function findApprovedReschedule(int $timetableId, Carbon $date): ?RescheduledSession
    {
        $dateString = $date->toDateString();
        $timetable = TimeTable::with('classRoom')->find($timetableId);

        if (!$timetable) {
            return null;
        }

        $sessions = RescheduledSession::query()
            ->with(['timetable.course', 'timetable.classRoom', 'classroom', 'approver:id,name'])
            ->where('timetable_id', $timetableId)
            ->whereIn('status', RescheduledSession::approvedStatuses())
            ->where(function ($query) use ($dateString) {
                $query->whereDate('original_date', $dateString)
                    ->orWhereDate('new_date', $dateString)
                    ->orWhereDate('original_date', '>=', $dateString);
            })
            ->orderBy('original_date')
            ->get();

        return $sessions->first(function (RescheduledSession $session) use ($dateString, $timetable) {
            if ($this->matchesDate($session->new_date, $dateString)) {
                return true;
            }

            if (!$session->timetable) {
                $session->setRelation('timetable', $timetable);
            }

            return $this->effectiveOriginalDate($session, $timetable) === $dateString;
        });
    }

    /**
     * @return array{
     *     state: string,
     *     can_take_attendance: bool,
     *     attendance_blocked_message: string|null,
     *     rescheduled_session_id: int|null,
     *     effective_start_time: string,
     *     effective_end_time: string,
     *     effective_classroom: ClassRoom|null,
     *     reschedule: array<string, mixed>|null,
     * }
     */
    public function resolveAttendanceContext(TimeTable $timetable, Carbon $date, ?RescheduledSession $reschedule = null): array
    {
        $reschedule ??= $this->findApprovedReschedule((int) $timetable->id, $date);
        $dateString = $date->toDateString();

        if ($reschedule && $this->effectiveOriginalDate($reschedule, $timetable) === $dateString) {
            return [
                'state' => self::STATE_RESCHEDULED_AWAY,
                'can_take_attendance' => false,
                'attendance_blocked_message' => 'Attendance is unavailable because this session has been rescheduled.',
                'rescheduled_session_id' => $reschedule->id,
                'effective_start_time' => (string) $timetable->start_time,
                'effective_end_time' => (string) $timetable->end_time,
                'effective_classroom' => $timetable->classRoom,
                'reschedule' => $this->formatReschedulePayload($timetable, $reschedule),
            ];
        }

        if ($reschedule && $this->matchesDate($reschedule->new_date, $dateString)) {
            return [
                'state' => self::STATE_RESCHEDULED_ACTIVE,
                'can_take_attendance' => true,
                'attendance_blocked_message' => null,
                'rescheduled_session_id' => $reschedule->id,
                'effective_start_time' => (string) $reschedule->new_start_time,
                'effective_end_time' => (string) $reschedule->new_end_time,
                'effective_classroom' => $reschedule->classroom ?? $timetable->classRoom,
                'reschedule' => $this->formatReschedulePayload($timetable, $reschedule),
            ];
        }

        return [
            'state' => self::STATE_NORMAL,
            'can_take_attendance' => true,
            'attendance_blocked_message' => null,
            'rescheduled_session_id' => null,
            'effective_start_time' => (string) $timetable->start_time,
            'effective_end_time' => (string) $timetable->end_time,
            'effective_classroom' => $timetable->classRoom,
            'reschedule' => null,
        ];
    }

    public function assertAttendanceAllowed(TimeTable $timetable, Carbon $date): ?array
    {
        $context = $this->resolveAttendanceContext($timetable, $date);

        if (!$context['can_take_attendance']) {
            return [
                'success' => false,
                'message' => $context['attendance_blocked_message'],
                'state' => $context['state'],
            ];
        }

        return null;
    }

    public function assertSessionAttendanceAllowed(TimeTable $timetable, Carbon $date, ?int $rescheduledSessionId = null): ?array
    {
        if ($blocked = $this->assertAttendanceAllowed($timetable, $date)) {
            return $blocked;
        }

        $attendance = TeacherAttendance::query()
            ->where('teacher_id', $timetable->teacher_id)
            ->where('timetable_id', $timetable->id)
            ->whereDate('date', $date->toDateString())
            ->when(
                $rescheduledSessionId,
                fn ($query) => $query->where('rescheduled_session_id', $rescheduledSessionId),
                fn ($query) => $query->whereNull('rescheduled_session_id'),
            )
            ->first();

        if ($this->isMissedAttendance($attendance)) {
            return [
                'success' => false,
                'message' => 'This session was marked as missed. Attendance is no longer available.',
                'state' => 'missed',
            ];
        }

        return null;
    }

    public function isMissedAttendance(?TeacherAttendance $attendance): bool
    {
        return $attendance !== null && $attendance->status === 'absent';
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function buildTodaysClasses(int $teacherId, Carbon $date): array
    {
        $context = $this->loadTeacherRescheduleContext($teacherId, $date);
        $movedAway = $context['moved_away'];
        $activeToday = $context['active_today'];
        $classes = [];
        $processedTimetableIds = [];
        $attendanceDate = $date->toDateString();
        $timetableIds = [];

        foreach (TimeTable::todaysLectures() as $lecture) {
            $timetableIds[] = $lecture->id;
        }

        foreach ($activeToday as $reschedule) {
            if ($reschedule->timetable) {
                $timetableIds[] = (int) $reschedule->timetable_id;
            }
        }

        $attendances = TeacherAttendance::query()
            ->where('teacher_id', $teacherId)
            ->whereDate('date', $attendanceDate)
            ->when(!empty($timetableIds), fn ($query) => $query->whereIn('timetable_id', array_unique($timetableIds)))
            ->get();

        foreach (TimeTable::todaysLectures() as $lecture) {
            $processedTimetableIds[] = $lecture->id;
            $reschedule = $movedAway->get($lecture->id) ?? $activeToday->get($lecture->id);
            $classes[] = $this->buildClassPayload($lecture, $date, $teacherId, $reschedule, $attendances);
        }

        foreach ($activeToday as $timetableId => $reschedule) {
            if (in_array($timetableId, $processedTimetableIds, true)) {
                continue;
            }

            $lecture = $reschedule->timetable;
            if (!$lecture || $lecture->teacher_id !== $teacherId) {
                continue;
            }

            $classes[] = $this->buildClassPayload($lecture, $date, $teacherId, $reschedule, $attendances);
        }

        usort($classes, fn (array $a, array $b) => strcmp((string) $a['start_time'], (string) $b['start_time']));

        return $classes;
    }

    /**
     * @return array<string, mixed>
     */
    public function buildClassPayload(
        TimeTable $lecture,
        Carbon $date,
        int $teacherId,
        ?RescheduledSession $reschedule = null,
        ?Collection $attendances = null,
    ): array {
        $attendanceContext = $this->resolveAttendanceContext($lecture, $date, $reschedule);
        $classroom = $attendanceContext['effective_classroom'] ?? $lecture->classRoom;
        $attendanceDate = $date->toDateString();
        $isRescheduledAway = $attendanceContext['state'] === self::STATE_RESCHEDULED_AWAY;
        $displayClassroom = $isRescheduledAway ? $lecture->classRoom : $classroom;

        $attendance = $this->findAttendanceForSession(
            $attendances ?? collect(),
            $teacherId,
            (int) $lecture->id,
            $attendanceDate,
            $attendanceContext['rescheduled_session_id'],
        );

        $attendanceStatus = null;
        $attendanceTaken = false;
        $isMissed = false;

        if ($attendance) {
            $attendanceTaken = true;
            $isMissed = $this->isMissedAttendance($attendance);
            $attendanceStatus = [
                'id' => $attendance->id,
                'check_in_time' => $attendance->check_in_time,
                'check_out_time' => $attendance->check_out_time,
                'status' => $isMissed
                    ? 'absent'
                    : ($attendance->check_out_time ? 'completed' : 'checked_in'),
                'location_match' => (bool) $attendance->check_in_within_range,
            ];
        } else {
            $isMissed = false;
        }

        $canTakeAttendance = $attendanceContext['can_take_attendance'];
        $attendanceBlockedMessage = $attendanceContext['attendance_blocked_message'];

        if ($isMissed) {
            $canTakeAttendance = false;
            $attendanceBlockedMessage = 'This session was marked as missed. Attendance is no longer available.';
        }

        return [
            'timetable_id' => $lecture->id,
            'id' => $lecture->course->id,
            'name' => $lecture->course->name,
            'code' => $lecture->course->course_code,
            'building' => $displayClassroom?->name ?? $lecture->classRoom?->name,
            'room' => $displayClassroom?->room_number ?? $lecture->classRoom?->room_number ?? 'N/A',
            'type' => 'lecture',
            'students' => $lecture->course->student_size,
            'start_time' => $isRescheduledAway ? (string) $lecture->start_time : $attendanceContext['effective_start_time'],
            'end_time' => $isRescheduledAway ? (string) $lecture->end_time : $attendanceContext['effective_end_time'],
            'original_start_time' => $lecture->start_time,
            'original_end_time' => $lecture->end_time,
            'coordinates' => [
                'lat' => $displayClassroom?->latitude ?? $lecture->classRoom?->latitude,
                'lng' => $displayClassroom?->longitude ?? $lecture->classRoom?->longitude,
            ],
            'radius' => $displayClassroom?->radius_meters ?? $lecture->classRoom?->radius_meters,
            'attendance_taken' => $attendanceTaken,
            'attendance_status' => $attendanceStatus,
            'is_completed' => $attendance && $attendance->check_out_time !== null,
            'is_missed' => $isMissed,
            'attendance_state' => $isMissed ? 'missed' : $attendanceContext['state'],
            'can_take_attendance' => $canTakeAttendance,
            'attendance_blocked_message' => $attendanceBlockedMessage,
            'rescheduled_session_id' => $attendanceContext['rescheduled_session_id'],
            'reschedule' => $attendanceContext['reschedule'],
            'timing' => $this->timingService->buildScheduleTiming(
                $isRescheduledAway ? (string) $lecture->start_time : $attendanceContext['effective_start_time'],
                $isRescheduledAway ? (string) $lecture->end_time : $attendanceContext['effective_end_time'],
                $date,
                AttendanceTimingService::ROLE_TEACHER
            ),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function resolveEffectiveSessionDetails(TimeTable $timetable, Carbon $date): array
    {
        $context = $this->resolveAttendanceContext($timetable, $date);
        $classroom = $context['effective_classroom'] ?? $timetable->classRoom;
        $reschedule = $context['reschedule'] ?? null;

        return [
            'start_time' => $context['effective_start_time'],
            'end_time' => $context['effective_end_time'],
            'venue' => $classroom?->name,
            'room' => $classroom?->room_number,
            'date' => $date->toDateString(),
            'date_display' => $date->format('l, F j, Y'),
            'start_time_display' => $this->formatTime($context['effective_start_time']),
            'end_time_display' => $this->formatTime($context['effective_end_time']),
            'is_rescheduled' => $context['state'] === self::STATE_RESCHEDULED_ACTIVE,
            'reschedule' => $reschedule,
        ];
    }

    private function findAttendanceForSession(
        Collection $attendances,
        int $teacherId,
        int $timetableId,
        string $date,
        ?int $rescheduledSessionId,
    ): ?TeacherAttendance {
        if ($attendances->isEmpty()) {
            return TeacherAttendance::query()
                ->where('teacher_id', $teacherId)
                ->where('timetable_id', $timetableId)
                ->whereDate('date', $date)
                ->when(
                    $rescheduledSessionId,
                    fn ($query) => $query->where('rescheduled_session_id', $rescheduledSessionId),
                    fn ($query) => $query->whereNull('rescheduled_session_id'),
                )
                ->first();
        }

        return $attendances->first(function (TeacherAttendance $attendance) use ($teacherId, $timetableId, $date, $rescheduledSessionId) {
            if ((int) $attendance->teacher_id !== $teacherId) {
                return false;
            }

            if ((int) $attendance->timetable_id !== $timetableId) {
                return false;
            }

            if (Carbon::parse($attendance->date)->toDateString() !== $date) {
                return false;
            }

            return (int) ($attendance->rescheduled_session_id ?? 0) === (int) ($rescheduledSessionId ?? 0);
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function formatReschedulePayload(TimeTable $timetable, RescheduledSession $reschedule): array
    {
        $originalClassroom = $timetable->classRoom;
        $newClassroom = $reschedule->classroom ?? $originalClassroom;
        $effectiveOriginalDate = $this->effectiveOriginalDate($reschedule, $timetable);

        return [
            'id' => $reschedule->id,
            'status' => $reschedule->status,
            'reason' => $reschedule->reason,
            'note' => $reschedule->note,
            'approved_by_name' => $reschedule->approver?->name,
            'approved_at_display' => $reschedule->approved_at
                ? Carbon::parse($reschedule->approved_at)->format('M j, Y g:i A')
                : null,
            'original_date' => $effectiveOriginalDate,
            'original_date_display' => Carbon::parse($effectiveOriginalDate)->format('l, M j, Y'),
            'original_start_time' => $reschedule->original_start_time,
            'original_end_time' => $reschedule->original_end_time,
            'original_start_time_display' => $this->formatTime($reschedule->original_start_time),
            'original_end_time_display' => $this->formatTime($reschedule->original_end_time),
            'original_venue' => $originalClassroom?->name,
            'original_room' => $originalClassroom?->room_number,
            'new_date' => $reschedule->new_date,
            'new_date_display' => Carbon::parse($reschedule->new_date)->format('l, M j, Y'),
            'new_start_time' => $reschedule->new_start_time,
            'new_end_time' => $reschedule->new_end_time,
            'new_start_time_display' => $this->formatTime($reschedule->new_start_time),
            'new_end_time_display' => $this->formatTime($reschedule->new_end_time),
            'new_venue' => $newClassroom?->name,
            'new_room' => $newClassroom?->room_number,
            'venue_changed' => ($originalClassroom?->id ?? null) !== ($newClassroom?->id ?? null),
            'time_changed' => $reschedule->original_start_time !== $reschedule->new_start_time
                || $reschedule->original_end_time !== $reschedule->new_end_time
                || $reschedule->original_date !== $reschedule->new_date,
            'rescheduled_from_badge' => sprintf(
                'Rescheduled from %s, %s – %s, %s',
                Carbon::parse($effectiveOriginalDate)->format('l'),
                $this->formatTime($reschedule->original_start_time),
                $this->formatTime($reschedule->original_end_time),
                $originalClassroom?->name ?? 'Original venue',
            ),
            'summary' => sprintf(
                'Rescheduled from %s %s – %s, %s to %s %s – %s, %s',
                Carbon::parse($effectiveOriginalDate)->format('l'),
                $this->formatTime($reschedule->original_start_time),
                $this->formatTime($reschedule->original_end_time),
                $originalClassroom?->name ?? 'Original venue',
                Carbon::parse($reschedule->new_date)->format('l'),
                $this->formatTime($reschedule->new_start_time),
                $this->formatTime($reschedule->new_end_time),
                $newClassroom?->name ?? 'New venue',
            ),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function formatRecordReschedule(?TeacherAttendance $record): ?array
    {
        if (!$record?->rescheduled_session_id) {
            return null;
        }

        $record->loadMissing(['rescheduledSession.timetable.classRoom', 'rescheduledSession.classroom', 'timetable.classRoom']);

        $reschedule = $record->rescheduledSession;
        if (!$reschedule || !$record->timetable) {
            return null;
        }

        return $this->formatReschedulePayload($record->timetable, $reschedule);
    }

    public function shouldSkipAutoAbsentForMovedSession(TimeTable $schedule, Carbon $date): bool
    {
        $reschedule = $this->findApprovedReschedule((int) $schedule->id, $date);

        return $reschedule !== null && $this->effectiveOriginalDate($reschedule, $schedule) === $date->toDateString();
    }

    private function effectiveOriginalDate(RescheduledSession $reschedule, TimeTable $timetable): string
    {
        $stored = Carbon::parse($reschedule->original_date)->startOfDay();
        $newDate = Carbon::parse($reschedule->new_date)->startOfDay();
        $timetableDay = $timetable->day_of_week ?? $timetable->day;

        if ($timetableDay && $stored->format('l') === $timetableDay && $newDate->greaterThanOrEqualTo($stored)) {
            return $stored->toDateString();
        }

        if ($newDate->lessThan($stored)) {
            $shifted = $stored->copy()->subDays(7);

            if ($timetableDay && $shifted->format('l') === $timetableDay && $newDate->greaterThanOrEqualTo($shifted)) {
                return $shifted->toDateString();
            }
        }

        return $stored->toDateString();
    }

    private function matchesDate(mixed $value, string $dateString): bool
    {
        return Carbon::parse($value)->toDateString() === $dateString;
    }

    public function resolveProcessorEndTime(TimeTable $schedule, Carbon $date): ?string
    {
        $reschedule = RescheduledSession::query()
            ->where('timetable_id', $schedule->id)
            ->whereIn('status', RescheduledSession::approvedStatuses())
            ->whereDate('new_date', $date->toDateString())
            ->first();

        if ($reschedule) {
            return (string) $reschedule->new_end_time;
        }

        if ($this->shouldSkipAutoAbsentForMovedSession($schedule, $date)) {
            return null;
        }

        return (string) $schedule->end_time;
    }

    private function formatTime(?string $time): string
    {
        if (!$time) {
            return '--:--';
        }

        return Carbon::createFromFormat('H:i:s', strlen($time) === 5 ? "{$time}:00" : $time)->format('h:i A');
    }
}
