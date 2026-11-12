<?php

namespace App\Services;

use App\Jobs\SendAttendanceScheduleReminderJob;
use App\Models\AttendanceReminder;
use App\Models\AttendanceReminderDispatch;
use App\Models\AttendanceReminderTarget;
use App\Models\StaffAttendance;
use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Models\TimeTable;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Support\Collection;

class AttendanceReminderService
{
    public const DEFAULT_LIMIT = 5;

    public const CATCH_UP_MINUTES = 10;

    public function __construct(
        private RescheduledAttendanceService $reschedules,
        private HolidayBreakService $holidays,
    ) {}

    public function limit(): int
    {
        return max(1, (int) SystemSetting::getValue('max_reminders_per_administrator', self::DEFAULT_LIMIT));
    }

    public function usage(Teacher $teacher): int
    {
        return AttendanceReminder::query()->where('teacher_id', $teacher->id)->count();
    }

    public function canCreate(Teacher $teacher): bool
    {
        return $teacher->isAdministrator() && $this->usage($teacher) < $this->limit();
    }

    public function visibleQuery(Teacher $teacher)
    {
        return AttendanceReminder::query()->where('teacher_id', $teacher->id);
    }

    /**
     * @return list<array{id: int, day: string, start: string, end: string, venue: string, label: string}>
     */
    public function assignedSchedules(Teacher $teacher): array
    {
        $order = array_flip(AttendanceReminder::DAYS);

        return TimeTable::query()
            ->where('teacher_id', $teacher->id)
            ->where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR)
            ->with('classRoom:id,name')
            ->get()
            ->sortBy(fn (TimeTable $timetable) => sprintf('%02d-%s', $order[$timetable->day_of_week] ?? 99, $timetable->start_time))
            ->map(function (TimeTable $timetable) {
                $start = $this->clockLabel((string) $timetable->start_time);
                $end = $this->clockLabel((string) $timetable->end_time);
                $venue = trim((string) ($timetable->classRoom?->name ?? ''));

                return [
                    'id' => $timetable->id,
                    'day' => (string) $timetable->day_of_week,
                    'start' => $start,
                    'end' => $end,
                    'venue' => $venue,
                    'label' => trim($timetable->day_of_week.' · '.$start.' – '.$end.($venue !== '' ? ' · '.$venue : '')),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param  list<int>  $timetableIds
     */
    public function syncSchedules(AttendanceReminder $reminder, array $timetableIds): void
    {
        $owned = TimeTable::query()
            ->where('teacher_id', $reminder->teacher_id)
            ->where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR)
            ->whereIn('id', $timetableIds)
            ->get(['id', 'day_of_week']);

        $reminder->targets()->where('target_type', AttendanceReminderTarget::TYPE_TIMETABLE)->delete();
        $reminder->targets()->createMany($owned->map(fn (TimeTable $timetable) => [
            'target_type' => AttendanceReminderTarget::TYPE_TIMETABLE,
            'target_id' => $timetable->id,
        ])->all());

        $order = array_flip(AttendanceReminder::DAYS);
        $days = $owned->pluck('day_of_week')
            ->unique()
            ->sortBy(fn (string $day) => $order[$day] ?? 99)
            ->values()
            ->all();

        $reminder->update(['days' => $days]);
        $reminder->unsetRelation('targets');
    }

    /**
     * @return list<int>
     */
    public function selectedTimetableIds(AttendanceReminder $reminder): array
    {
        $reminder->loadMissing('targets');

        return $reminder->targets
            ->where('target_type', AttendanceReminderTarget::TYPE_TIMETABLE)
            ->pluck('target_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();
    }

    /**
     * @return Collection<int, Teacher>
     */
    public function recipients(AttendanceReminder $reminder): Collection
    {
        $teacher = $reminder->relationLoaded('teacher') ? $reminder->teacher : $reminder->teacher()->first();

        if (! $teacher instanceof Teacher || ! $teacher->isAdministrator()) {
            return collect();
        }

        return collect([$teacher]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function sessionsFor(Teacher $teacher, Carbon $date, ?AttendanceReminder $reminder = null): array
    {
        if ($this->holidays->isAttendanceSuspended($teacher, $date)) {
            return [];
        }

        $selectedIds = $reminder ? $this->selectedTimetableIds($reminder) : [];

        if ($selectedIds === []) {
            return [];
        }

        if ($teacher->isAdministrator()) {
            return $this->administratorSessions($teacher, $date, $selectedIds);
        }

        return array_values(array_filter(
            $this->lecturerSessions($teacher, $date),
            fn (array $session) => in_array((int) $session['timetable_id'], $selectedIds, true),
        ));
    }

    public function triggerAt(AttendanceReminder $reminder, Carbon $start, Carbon $end): Carbon
    {
        $anchor = in_array($reminder->trigger, [
            AttendanceReminder::TRIGGER_BEFORE_END,
            AttendanceReminder::TRIGGER_AFTER_END,
        ], true) ? $end->copy() : $start->copy();

        $minutes = in_array($reminder->trigger, [
            AttendanceReminder::TRIGGER_BEFORE_START,
            AttendanceReminder::TRIGGER_BEFORE_END,
        ], true) ? -1 * $reminder->offset_minutes : $reminder->offset_minutes;

        return $anchor->addMinutes($minutes);
    }

    public function messageFor(AttendanceReminder $reminder, array $session): string
    {
        $custom = trim((string) $reminder->message);

        if ($custom !== '') {
            return $custom;
        }

        $offset = (int) $reminder->offset_minutes;

        if ($offset === 0 && $reminder->trigger === AttendanceReminder::TRIGGER_AFTER_END) {
            return 'Attendance Reminder: Your scheduled session has ended. Please check out if you have not already done so.';
        }

        if ($offset === 0 && $reminder->trigger === AttendanceReminder::TRIGGER_AFTER_START) {
            return 'Attendance Reminder: Your scheduled session has started. Please check in if you have not already done so.';
        }

        $when = $offset.' '.($offset === 1 ? 'minute' : 'minutes');

        if ($reminder->type === AttendanceReminder::TYPE_CHECK_OUT) {
            return match ($reminder->trigger) {
                AttendanceReminder::TRIGGER_BEFORE_END => "Attendance Reminder: Your scheduled session ends in {$when}. Please check out if you have not already done so.",
                AttendanceReminder::TRIGGER_AFTER_END => "Attendance Reminder: Your scheduled session ended {$when} ago. Please check out if you have not already done so.",
                default => 'Attendance Reminder: Your scheduled session has ended. Please check out if you have not already done so.',
            };
        }

        return match ($reminder->trigger) {
            AttendanceReminder::TRIGGER_BEFORE_START => "Attendance Reminder: Your scheduled session starts in {$when}. Please check in if you have not already done so.",
            AttendanceReminder::TRIGGER_AFTER_START => "Attendance Reminder: Your scheduled session started {$when} ago. Please check in if you have not already done so.",
            default => 'Attendance Reminder: Please complete your attendance check-in if you have not already done so.',
        };
    }

    /**
     * @param  array<string, mixed>  $session
     */
    public function actionCompleted(AttendanceReminder $reminder, array $session): bool
    {
        if ($reminder->type === AttendanceReminder::TYPE_CHECK_OUT) {
            return (bool) ($session['checked_out'] ?? false);
        }

        return (bool) ($session['checked_in'] ?? false);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function upcoming(AttendanceReminder $reminder, Carbon $from, int $days = 7, int $limit = 20): array
    {
        if (! $reminder->is_active) {
            return [];
        }

        $reminder->loadMissing('teacher');
        $occurrences = [];

        for ($offset = 0; $offset < $days && count($occurrences) < $limit; $offset++) {
            $day = $from->copy()->startOfDay()->addDays($offset);

            foreach ($this->recipients($reminder) as $teacher) {
                foreach ($this->sessionsFor($teacher, $day, $reminder) as $session) {
                    if (! ($session['eligible'] ?? false)) {
                        continue;
                    }

                    $trigger = $this->triggerAt($reminder, $session['start'], $session['end']);

                    if ($trigger->lt($from)) {
                        continue;
                    }

                    $occurrences[] = $this->occurrencePayload($reminder, $teacher, $session, $trigger);
                }
            }
        }

        usort($occurrences, fn (array $left, array $right) => strcmp($left['scheduled_for'], $right['scheduled_for']));

        return array_slice($occurrences, 0, $limit);
    }

    public function nextOccurrence(AttendanceReminder $reminder, ?Carbon $from = null): ?array
    {
        $items = $this->upcoming($reminder, $from ?? now(), 14, 1);

        return $items[0] ?? null;
    }

    public function previewNext(AttendanceReminder $reminder): ?string
    {
        $first = $this->previewOccurrences($reminder, 14, 1);

        return $first[0]['scheduled_for_display'] ?? null;
    }

    public function previewUpcomingCount(AttendanceReminder $reminder): int
    {
        return count($this->previewOccurrences($reminder, 7, 200));
    }

    /**
     * @return list<array{scheduled_for_display: string}>
     */
    private function previewOccurrences(AttendanceReminder $reminder, int $days, int $limit): array
    {
        if (! $reminder->is_active) {
            return [];
        }

        $teacherIds = $this->recipients($reminder)->pluck('id');

        if ($teacherIds->isEmpty()) {
            return [];
        }

        $found = [];
        $from = now();

        for ($offset = 0; $offset < $days && count($found) < $limit; $offset++) {
            $day = $from->copy()->startOfDay()->addDays($offset);

            $slots = TimeTable::query()
                ->whereIn('id', $this->selectedTimetableIds($reminder))
                ->whereIn('teacher_id', $teacherIds)
                ->where('day_of_week', $day->format('l'))
                ->orderBy('start_time')
                ->get(['id', 'teacher_id', 'start_time', 'end_time']);

            foreach ($slots as $slot) {
                $trigger = $this->triggerAt(
                    $reminder,
                    $this->atTime($day, (string) $slot->start_time),
                    $this->atTime($day, (string) $slot->end_time),
                );

                if ($trigger->lt($from)) {
                    continue;
                }

                $found[] = ['scheduled_for_display' => $trigger->format('D, M j, Y g:i A')];

                if (count($found) >= $limit) {
                    break;
                }
            }
        }

        return $found;
    }

    public function processDue(?Carbon $now = null): int
    {
        $now = ($now ?? now())->copy();
        $queued = 0;

        $reminders = AttendanceReminder::query()
            ->where('is_active', true)
            ->with(['teacher', 'targets'])
            ->get();

        foreach ($reminders as $reminder) {
            foreach ($this->recipients($reminder) as $teacher) {
                foreach ($this->sessionsFor($teacher, $now, $reminder) as $session) {
                    if (! ($session['eligible'] ?? false) || $this->actionCompleted($reminder, $session)) {
                        continue;
                    }

                    $trigger = $this->triggerAt($reminder, $session['start'], $session['end']);

                    if ($trigger->gt($now) || $trigger->lte($now->copy()->subMinutes(self::CATCH_UP_MINUTES))) {
                        continue;
                    }

                    $dispatch = $this->claimDispatch($reminder, $teacher, $session, $trigger);

                    if (! $dispatch) {
                        continue;
                    }

                    SendAttendanceScheduleReminderJob::dispatch($dispatch->id);
                    $queued++;
                }
            }
        }

        return $queued;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function lecturerSessions(Teacher $teacher, Carbon $date): array
    {
        $sessions = [];

        foreach ($this->reschedules->buildTodaysClasses($teacher->id, $date) as $class) {
            $status = $class['attendance_status'] ?? null;
            $movedAway = ($class['attendance_state'] ?? null) === RescheduledAttendanceService::STATE_RESCHEDULED_AWAY;

            $sessions[] = [
                'timetable_id' => (int) $class['timetable_id'],
                'rescheduled_session_id' => $class['rescheduled_session_id'] ?? null,
                'label' => (string) ($class['name'] ?? 'Scheduled session'),
                'venue' => trim(((string) ($class['building'] ?? '')).' '.((string) ($class['room'] ?? ''))),
                'start' => $this->atTime($date, (string) $class['start_time']),
                'end' => $this->atTime($date, (string) $class['end_time']),
                'checked_in' => is_array($status) && ! empty($status['check_in_time']),
                'checked_out' => is_array($status) && ! empty($status['check_out_time']),
                'eligible' => (bool) ($class['can_take_attendance'] ?? false)
                    && ! (bool) ($class['is_missed'] ?? false)
                    && ! $movedAway,
            ];
        }

        return $sessions;
    }

    /**
     * @return list<array<string, mixed>>
     */
    /**
     * @param  list<int>  $timetableIds
     * @return list<array<string, mixed>>
     */
    private function administratorSessions(Teacher $teacher, Carbon $date, array $timetableIds): array
    {
        $timetables = TimeTable::query()
            ->where('teacher_id', $teacher->id)
            ->where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR)
            ->where('day_of_week', $date->format('l'))
            ->whereIn('id', $timetableIds)
            ->with('classRoom')
            ->orderBy('start_time')
            ->get();

        $attendance = StaffAttendance::query()
            ->where('staff_id', $teacher->id)
            ->whereDate('date', $date->toDateString())
            ->get()
            ->keyBy('timetable_id');

        return $timetables->map(function (TimeTable $timetable) use ($date, $attendance) {
            /** @var StaffAttendance|null $record */
            $record = $attendance->get($timetable->id);
            $locked = $record?->isAbsenceLocked() ?? false;

            return [
                'timetable_id' => $timetable->id,
                'rescheduled_session_id' => null,
                'label' => 'Scheduled duty',
                'venue' => trim((string) ($timetable->classRoom?->name ?? '')),
                'start' => $this->atTime($date, (string) $timetable->start_time),
                'end' => $this->atTime($date, (string) $timetable->end_time),
                'checked_in' => $record?->check_in_time !== null,
                'checked_out' => $record?->check_out_time !== null,
                'eligible' => ! $locked,
            ];
        })->all();
    }

    private function clockLabel(string $time): string
    {
        return $this->atTime(now(), $time)->format('g:i A');
    }

    private function atTime(Carbon $date, string $time): Carbon
    {
        $clock = strlen($time) === 5 ? $time.':00' : $time;

        return Carbon::parse($date->toDateString().' '.$clock, config('app.timezone'));
    }

    /**
     * @param  array<string, mixed>  $session
     */
    private function claimDispatch(AttendanceReminder $reminder, Teacher $teacher, array $session, Carbon $trigger): ?AttendanceReminderDispatch
    {
        $existing = AttendanceReminderDispatch::query()
            ->where('attendance_reminder_id', $reminder->id)
            ->where('teacher_id', $teacher->id)
            ->where('timetable_id', $session['timetable_id'])
            ->whereDate('session_date', $session['start']->toDateString())
            ->first();

        if ($existing) {
            return null;
        }

        try {
            return AttendanceReminderDispatch::query()->create([
                'attendance_reminder_id' => $reminder->id,
                'teacher_id' => $teacher->id,
                'timetable_id' => $session['timetable_id'],
                'session_date' => $session['start']->toDateString(),
                'rescheduled_session_id' => $session['rescheduled_session_id'],
                'scheduled_for' => $trigger,
                'status' => AttendanceReminderDispatch::STATUS_PENDING,
            ]);
        } catch (QueryException) {
            return null;
        }
    }

    /**
     * @param  array<string, mixed>  $session
     * @return array<string, mixed>
     */
    private function occurrencePayload(AttendanceReminder $reminder, Teacher $teacher, array $session, Carbon $trigger): array
    {
        return [
            'reminder_id' => $reminder->id,
            'teacher_id' => $teacher->id,
            'staff_name' => trim($teacher->title.' '.$teacher->first_name.' '.$teacher->last_name),
            'timetable_id' => $session['timetable_id'],
            'session' => $session['label'],
            'venue' => $session['venue'],
            'scheduled_for' => $trigger->toIso8601String(),
            'scheduled_for_display' => $trigger->format('D, M j, Y g:i A'),
            'session_start' => $session['start']->format('g:i A'),
            'session_end' => $session['end']->format('g:i A'),
        ];
    }
}
