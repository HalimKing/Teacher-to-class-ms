<?php

namespace App\Services;

use App\Models\SelfReportedAbsenceReply;
use App\Models\StaffAttendance;
use App\Models\Teacher;
use App\Models\TeacherAttendance;
use App\Models\TimeTable;
use App\Notifications\SelfReportedAbsenceReplyPosted;
use App\Notifications\SelfReportedAbsenceSubmitted;
use App\Support\AttendanceExceptionCategory;
use App\Support\AttendanceLock;
use App\Support\AttendanceRecordSource;
use App\Support\LeadershipAssignment;
use App\Support\SelfReportedAbsence;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class SelfReportedAbsenceService
{
    public function __construct(
        private RescheduledAttendanceService $rescheduledAttendance,
        private HolidayBreakService $holidayBreaks,
        private AttendanceTimingService $timingService,
        private ActivityLogService $activityLog,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function composeLecturerForm(Teacher $actor, TimeTable $timetable): array
    {
        abort_unless($actor->isLecturer(), 403);
        $this->assertOwnsTimetable($actor, $timetable);

        $now = now();
        $this->assertAttendanceNotSuspended($actor, $now);

        $context = $this->rescheduledAttendance->resolveAttendanceContext($timetable, $now);
        $attendance = $this->findLecturerAttendance($actor, $timetable, $now, $context['rescheduled_session_id'] ?? null);
        $this->assertCanSelfReport($attendance, $this->isLecturerMissed($attendance, $context, $now, $timetable), $context['state'] === RescheduledAttendanceService::STATE_RESCHEDULED_AWAY);

        $timetable->loadMissing(['course', 'classRoom']);
        $classroom = $context['effective_classroom'] ?? $timetable->classRoom;

        return $this->formPayload(
            actor: $actor,
            timetable: $timetable,
            kind: SelfReportedAbsence::KIND_LECTURER,
            date: $now,
            sessionLabel: trim(($timetable->course?->course_code ? $timetable->course->course_code.' · ' : '').($timetable->course?->name ?? 'Lecture')).' · '.$this->formatTimeRange($context['effective_start_time'] ?? $timetable->start_time, $context['effective_end_time'] ?? $timetable->end_time),
            venue: $classroom?->name ?? $timetable->classRoom?->name,
            submitUrl: route('teacher.attendance.mark-absent.store'),
            cancelUrl: route('teacher.attendance'),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function composeStaffForm(Teacher $actor, TimeTable $timetable): array
    {
        abort_unless($actor->isAdministrator(), 403);
        $this->assertOwnsTimetable($actor, $timetable);

        $now = now();
        $this->assertAttendanceNotSuspended($actor, $now);
        $this->assertStaffSessionIsToday($timetable, $now);

        $attendance = $this->findStaffAttendance($actor, $timetable, $now);
        $this->assertCanSelfReport($attendance, $this->isStaffMissed($attendance, $timetable, $now));

        $timetable->loadMissing(['classRoom']);

        return $this->formPayload(
            actor: $actor,
            timetable: $timetable,
            kind: SelfReportedAbsence::KIND_ADMINISTRATOR,
            date: $now,
            sessionLabel: ($timetable->classRoom?->name ?? 'Shift').' · '.$this->formatTimeRange($timetable->start_time, $timetable->end_time),
            venue: $timetable->classRoom?->name,
            submitUrl: route('teacher.staff-attendance.mark-absent.store'),
            cancelUrl: route('teacher.staff-attendance'),
        );
    }

    /**
     * @param  array{reason: string, notes?: string|null}  $input
     * @return array{0: TeacherAttendance, 1: array<string, mixed>}
     */
    public function submitForLecturer(Teacher $actor, TimeTable $timetable, array $input): array
    {
        abort_unless($actor->isLecturer(), 403);
        $this->assertOwnsTimetable($actor, $timetable);

        return DB::transaction(function () use ($actor, $timetable, $input) {
            $now = now();
            $this->assertAttendanceNotSuspended($actor, $now);

            $context = $this->rescheduledAttendance->resolveAttendanceContext($timetable, $now);
            $rescheduledSessionId = $context['rescheduled_session_id'] ?? null;

            $attendance = $this->findLecturerAttendance($actor, $timetable, $now, $rescheduledSessionId, lock: true);
            $this->assertCanSelfReport(
                $attendance,
                $this->isLecturerMissed($attendance, $context, $now, $timetable),
                $context['state'] === RescheduledAttendanceService::STATE_RESCHEDULED_AWAY,
            );

            $classroom = $context['effective_classroom'] ?? $timetable->classRoom;
            $payload = $this->absenceAttributes($input, $now);

            if ($attendance) {
                $attendance->update($payload);
            } else {
                $attendance = TeacherAttendance::query()->create([
                    ...$payload,
                    'teacher_id' => $actor->id,
                    'timetable_id' => $timetable->id,
                    'rescheduled_session_id' => $rescheduledSessionId,
                    'course_id' => $timetable->course_id,
                    'classroom_id' => $classroom?->id ?? $timetable->class_room_id,
                    'academic_year_id' => $timetable->academic_year_id,
                    'date' => $now->toDateString(),
                ]);
            }

            $attendance = $attendance->fresh(['teacher', 'timetable.course', 'classroom']) ?? $attendance;
            $notify = $this->notifySupervisors($actor, $attendance, SelfReportedAbsence::KIND_LECTURER);

            $this->activityLog->log(
                'self_reported_absence_submitted',
                ActivityLogService::CATEGORY_ATTENDANCE,
                $actor->displayName().' self-reported an absence for timetable #'.$timetable->id.'.',
                metadata: [
                    'attendance_id' => $attendance->id,
                    'timetable_id' => $timetable->id,
                    'kind' => SelfReportedAbsence::KIND_LECTURER,
                    'notifications' => $notify,
                ],
            );

            return [$attendance, $notify];
        });
    }

    /**
     * @param  array{reason: string, notes?: string|null}  $input
     * @return array{0: StaffAttendance, 1: array<string, mixed>}
     */
    public function submitForStaff(Teacher $actor, TimeTable $timetable, array $input): array
    {
        abort_unless($actor->isAdministrator(), 403);
        $this->assertOwnsTimetable($actor, $timetable);

        return DB::transaction(function () use ($actor, $timetable, $input) {
            $now = now();
            $this->assertAttendanceNotSuspended($actor, $now);
            $this->assertStaffSessionIsToday($timetable, $now);

            $attendance = $this->findStaffAttendance($actor, $timetable, $now, lock: true);
            $this->assertCanSelfReport($attendance, $this->isStaffMissed($attendance, $timetable, $now));

            $payload = $this->absenceAttributes($input, $now);
            $payload['attendance_status'] = 'absent';
            unset($payload['status']);

            if ($attendance) {
                $attendance->update($payload);
            } else {
                $attendance = StaffAttendance::query()->create([
                    ...$payload,
                    'staff_id' => $actor->id,
                    'timetable_id' => $timetable->id,
                    'classroom_id' => $timetable->class_room_id,
                    'academic_year_id' => $timetable->academic_year_id,
                    'date' => $now->toDateString(),
                ]);
            }

            $attendance = $attendance->fresh(['staff', 'timetable', 'classroom']) ?? $attendance;
            $notify = $this->notifySupervisors($actor, $attendance, SelfReportedAbsence::KIND_ADMINISTRATOR);

            $this->activityLog->log(
                'self_reported_absence_submitted',
                ActivityLogService::CATEGORY_ATTENDANCE,
                $actor->displayName().' self-reported an absence for staff timetable #'.$timetable->id.'.',
                metadata: [
                    'attendance_id' => $attendance->id,
                    'timetable_id' => $timetable->id,
                    'kind' => SelfReportedAbsence::KIND_ADMINISTRATOR,
                    'notifications' => $notify,
                ],
            );

            return [$attendance, $notify];
        });
    }

    /**
     * @param  array<string, mixed>  $notify
     */
    public function successMessage(array $notify): string
    {
        $message = 'You have been marked absent for this attendance session.';

        $sentRoles = collect($notify['sent'] ?? [])->pluck('role')->unique()->values();
        $skippedRoles = collect($notify['skipped'] ?? [])->pluck('role')->unique()->values();
        $failedRoles = collect($notify['failed'] ?? [])->pluck('role')->unique()->values();

        if ($sentRoles->isNotEmpty()) {
            $message .= ' Notification sent to the '.$this->joinRoles($sentRoles->all()).'.';
        }

        if ($skippedRoles->isNotEmpty()) {
            $message .= ' No '.$this->joinRoles($skippedRoles->all()).' is currently assigned, so that notification was skipped.';
        }

        if ($failedRoles->isNotEmpty()) {
            $message .= ' Notification to the '.$this->joinRoles($failedRoles->all()).' could not be sent.';
        }

        return $message;
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeForLeader(TeacherAttendance|StaffAttendance $record, string $kind, bool $includeReplies = false): array
    {
        $staff = $kind === SelfReportedAbsence::KIND_LECTURER
            ? $record->teacher
            : $record->staff;
        $timetable = $record->timetable;
        $submittedAt = $record->self_reported_at ?? $record->updated_at;

        $payload = [
            'id' => $record->id,
            'kind' => $kind,
            'kind_label' => $kind === SelfReportedAbsence::KIND_LECTURER ? 'Lecture session' : 'Administrator shift',
            'staff_name' => $staff?->displayName(),
            'staff_role' => $staff?->staffTypeLabel(),
            'employee_id' => $staff?->employee_id,
            'staff_type' => $staff?->staff_type,
            'faculty' => $staff?->faculty?->name,
            'department' => $staff?->department?->name,
            'date' => $record->date?->toDateString(),
            'date_display' => $record->date?->format('l, M j, Y'),
            'session_label' => $kind === SelfReportedAbsence::KIND_LECTURER
                ? trim(($timetable?->course?->course_code ? $timetable->course->course_code.' · ' : '').($timetable?->course?->name ?? 'Lecture'))
                : ($record->classroom?->name ?? $timetable?->classRoom?->name ?? 'Shift'),
            'start_time' => $timetable?->start_time,
            'end_time' => $timetable?->end_time,
            'status' => $kind === SelfReportedAbsence::KIND_LECTURER ? $record->status : $record->attendance_status,
            'source' => AttendanceRecordSource::label($record->attendance_source, (bool) $record->auto_generated),
            'reason' => $record->self_reported_reason,
            'notes' => $record->self_reported_notes,
            'submitted_at' => $submittedAt?->toIso8601String(),
            'submitted_at_display' => $submittedAt?->timezone(config('app.timezone'))->format('M j, Y · g:i A'),
        ];

        if ($includeReplies) {
            $payload['replies'] = $this->serializeReplies($kind, (int) $record->id);
        }

        return $payload;
    }

    /**
     * @return array{0: SelfReportedAbsenceReply, 1: bool}
     */
    public function replyAsLeader(
        Teacher $leader,
        TeacherAttendance|StaffAttendance $record,
        string $kind,
        string $body,
    ): array {
        abort_unless($record->self_reported, 404);

        $staff = $kind === SelfReportedAbsence::KIND_LECTURER ? $record->teacher : $record->staff;
        abort_unless($staff instanceof Teacher, 404);

        $reply = SelfReportedAbsenceReply::query()->create([
            'attendance_kind' => $kind,
            'attendance_id' => $record->id,
            'author_id' => $leader->id,
            'body' => trim($body),
        ]);

        $notified = $this->notifyStaffOfReply($staff, $leader, $reply, $record, $kind);

        $this->activityLog->log(
            'self_reported_absence_replied',
            ActivityLogService::CATEGORY_ATTENDANCE,
            $leader->displayName().' replied to a self-reported absence.',
            metadata: [
                'reply_id' => $reply->id,
                'attendance_id' => $record->id,
                'kind' => $kind,
                'staff_id' => $staff->id,
                'notified' => $notified,
            ],
        );

        return [$reply->load('author'), $notified];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function serializeReplies(string $kind, int $attendanceId): array
    {
        return SelfReportedAbsenceReply::query()
            ->with('author')
            ->where('attendance_kind', $kind)
            ->where('attendance_id', $attendanceId)
            ->orderBy('created_at')
            ->get()
            ->map(fn (SelfReportedAbsenceReply $reply) => [
                'id' => $reply->id,
                'body' => $reply->body,
                'author_name' => $reply->author?->displayName() ?? 'Supervisor',
                'author_role' => $reply->author?->leadershipRoleLabel() ?: $reply->author?->staffTypeLabel(),
                'created_at' => $reply->created_at?->toIso8601String(),
                'created_at_display' => $reply->created_at?->timezone(config('app.timezone'))->format('M j, Y · g:i A'),
            ])
            ->all();
    }

    public function replySuccessMessage(bool $notified): string
    {
        return $notified
            ? 'Your reply has been sent and the staff member has been notified.'
            : 'Your reply has been saved. The staff member could not be notified.';
    }

    private function notifyStaffOfReply(
        Teacher $staff,
        Teacher $leader,
        SelfReportedAbsenceReply $reply,
        TeacherAttendance|StaffAttendance $record,
        string $kind,
    ): bool {
        if ((int) $staff->id === (int) $leader->id) {
            return false;
        }

        $details = [
            'author_role' => $leader->leadershipRoleLabel() ?: $leader->staffTypeLabel(),
            'date_display' => $record->date?->format('M j, Y') ?? now()->format('M j, Y'),
            'session_label' => $this->serializeForLeader($record, $kind)['session_label'],
            'url' => route('teacher.self-reported-absences.show', [
                'kind' => $kind,
                'attendance' => $record->id,
            ], false),
        ];

        try {
            $staff->notify(new SelfReportedAbsenceReplyPosted($reply, $leader, $details));

            return true;
        } catch (\Throwable $exception) {
            Log::error('Failed to notify staff of a self-reported absence reply.', [
                'staff_id' => $staff->id,
                'reply_id' => $reply->id,
                'error' => $exception->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * @return array<string, list<array<string, mixed>>>
     */
    private function notifySupervisors(Teacher $staff, TeacherAttendance|StaffAttendance $attendance, string $kind): array
    {
        $result = [
            'sent' => [],
            'skipped' => [],
            'failed' => [],
        ];

        $targets = $this->supervisorTargets($staff);
        $details = $this->notificationDetails($staff, $attendance, $kind);

        foreach ($targets as $target) {
            if ($target['teacher'] === null) {
                $result['skipped'][] = [
                    'role' => $target['role'],
                    'reason' => $target['skip_reason'],
                ];

                continue;
            }

            /** @var Teacher $supervisor */
            $supervisor = $target['teacher'];

            if ((int) $supervisor->id === (int) $staff->id) {
                $result['skipped'][] = [
                    'role' => $target['role'],
                    'reason' => 'The staff member is also assigned as this supervisor.',
                ];

                continue;
            }

            if ($this->alreadyQueued($result, (int) $supervisor->id)) {
                continue;
            }

            try {
                $supervisor->notify(new SelfReportedAbsenceSubmitted($staff, $attendance, [
                    ...$details,
                    'supervisor_role' => $target['role'],
                ]));

                $result['sent'][] = [
                    'role' => $target['role'],
                    'teacher_id' => $supervisor->id,
                    'email' => $supervisor->email,
                ];
            } catch (\Throwable $exception) {
                Log::error('Failed to notify supervisor of a self-reported absence.', [
                    'staff_id' => $staff->id,
                    'supervisor_id' => $supervisor->id,
                    'role' => $target['role'],
                    'error' => $exception->getMessage(),
                ]);

                $result['failed'][] = [
                    'role' => $target['role'],
                    'teacher_id' => $supervisor->id,
                    'reason' => $exception->getMessage(),
                ];
            }
        }

        return $result;
    }

    /**
     * @return list<array{role: string, teacher: ?Teacher, skip_reason: ?string}>
     */
    private function supervisorTargets(Teacher $staff): array
    {
        $dean = $staff->faculty_id
            ? Teacher::query()
                ->where('leadership_role', LeadershipAssignment::DIRECTOR_DEAN)
                ->where('leadership_faculty_id', $staff->faculty_id)
                ->orderBy('id')
                ->first()
            : null;

        $hod = $staff->department_id
            ? Teacher::query()
                ->where('leadership_role', LeadershipAssignment::HEAD_OF_DEPARTMENT)
                ->where('leadership_department_id', $staff->department_id)
                ->orderBy('id')
                ->first()
            : null;

        return [
            [
                'role' => LeadershipAssignment::label(LeadershipAssignment::DIRECTOR_DEAN) ?? 'Director/Dean',
                'teacher' => $dean,
                'skip_reason' => $dean ? null : 'No Director/Dean is assigned to this Directorate/Faculty.',
            ],
            [
                'role' => LeadershipAssignment::label(LeadershipAssignment::HEAD_OF_DEPARTMENT) ?? 'Head of Department',
                'teacher' => $hod,
                'skip_reason' => $hod ? null : 'No Head of Department is assigned to this department.',
            ],
        ];
    }

    /**
     * @param  array<string, list<array<string, mixed>>>  $result
     */
    private function alreadyQueued(array $result, int $teacherId): bool
    {
        return collect($result['sent'])->contains(fn (array $row) => (int) ($row['teacher_id'] ?? 0) === $teacherId)
            || collect($result['failed'])->contains(fn (array $row) => (int) ($row['teacher_id'] ?? 0) === $teacherId);
    }

    /**
     * @return array<string, mixed>
     */
    private function notificationDetails(Teacher $staff, TeacherAttendance|StaffAttendance $attendance, string $kind): array
    {
        $submittedAt = $attendance->self_reported_at ?? now();
        $timetable = $attendance->timetable;

        $sessionLabel = $kind === SelfReportedAbsence::KIND_LECTURER
            ? trim(($timetable?->course?->course_code ? $timetable->course->course_code.' · ' : '').($timetable?->course?->name ?? 'Lecture'))
                .' · '.$this->formatTimeRange($timetable?->start_time, $timetable?->end_time)
            : ($attendance->classroom?->name ?? $timetable?->classRoom?->name ?? 'Shift')
                .' · '.$this->formatTimeRange($timetable?->start_time, $timetable?->end_time);

        return [
            'kind' => $kind,
            'date_display' => $attendance->date?->format('M j, Y') ?? now()->format('M j, Y'),
            'session_label' => $sessionLabel,
            'reason' => (string) $attendance->self_reported_reason,
            'submitted_at' => $submittedAt->toIso8601String(),
            'submitted_at_display' => $submittedAt->timezone(config('app.timezone'))->format('M j, Y g:i A'),
            'url' => route('teacher.unit.self-reported-absences.show', [
                'kind' => $kind,
                'attendance' => $attendance->id,
            ], false),
        ];
    }

    /**
     * @param  array{reason: string, notes?: string|null}  $input
     * @return array<string, mixed>
     */
    private function absenceAttributes(array $input, Carbon $now): array
    {
        return [
            'status' => 'absent',
            'self_reported' => true,
            'self_reported_reason' => trim($input['reason']),
            'self_reported_notes' => filled($input['notes'] ?? null) ? trim((string) $input['notes']) : null,
            'self_reported_at' => $now,
            'attendance_source' => AttendanceRecordSource::SELF_REPORTED,
            'auto_generated' => false,
            'auto_generated_at' => null,
            'auto_absence_reason' => null,
            'exception_category' => AttendanceExceptionCategory::SELF_REPORTED_ABSENCE,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formPayload(
        Teacher $actor,
        TimeTable $timetable,
        string $kind,
        Carbon $date,
        string $sessionLabel,
        ?string $venue,
        string $submitUrl,
        string $cancelUrl,
    ): array {
        $actor->loadMissing(['faculty', 'department']);

        return [
            'kind' => $kind,
            'timetable_id' => $timetable->id,
            'date' => $date->toDateString(),
            'date_display' => $date->format('l, M j, Y'),
            'session_label' => $sessionLabel,
            'venue' => $venue,
            'staff' => [
                'name' => $actor->displayName(),
                'role' => $actor->staffTypeLabel(),
                'faculty' => $actor->faculty?->name,
                'department' => $actor->department?->name,
            ],
            'submit_url' => $submitUrl,
            'cancel_url' => $cancelUrl,
        ];
    }

    private function findLecturerAttendance(
        Teacher $actor,
        TimeTable $timetable,
        Carbon $now,
        ?int $rescheduledSessionId,
        bool $lock = false,
    ): ?TeacherAttendance {
        $query = TeacherAttendance::query()
            ->where('teacher_id', $actor->id)
            ->where('timetable_id', $timetable->id)
            ->whereDate('date', $now->toDateString())
            ->when(
                $rescheduledSessionId,
                fn ($builder) => $builder->where('rescheduled_session_id', $rescheduledSessionId),
                fn ($builder) => $builder->whereNull('rescheduled_session_id'),
            );

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first();
    }

    private function findStaffAttendance(Teacher $actor, TimeTable $timetable, Carbon $now, bool $lock = false): ?StaffAttendance
    {
        $query = StaffAttendance::query()
            ->where('staff_id', $actor->id)
            ->where('timetable_id', $timetable->id)
            ->whereDate('date', $now->toDateString());

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first();
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function isLecturerMissed(?TeacherAttendance $attendance, array $context, Carbon $now, TimeTable $timetable): bool
    {
        if ($attendance?->isAbsenceLocked()) {
            return true;
        }

        if ($attendance) {
            return false;
        }

        $endTime = $context['effective_end_time'] ?? $timetable->end_time;
        $scheduledEnd = $this->timingService->parseScheduleTime((string) $endTime, $now);

        return $this->timingService->hasCheckoutGraceExpired($now, $scheduledEnd);
    }

    private function isStaffMissed(?StaffAttendance $attendance, TimeTable $timetable, Carbon $now): bool
    {
        if ($attendance?->isAbsenceLocked()) {
            return true;
        }

        if ($attendance) {
            return false;
        }

        $scheduledEnd = $this->timingService->parseScheduleTime((string) $timetable->end_time, $now);

        return $this->timingService->hasCheckoutGraceExpired($now, $scheduledEnd);
    }

    private function assertOwnsTimetable(Teacher $actor, TimeTable $timetable): void
    {
        abort_unless((int) $timetable->teacher_id === (int) $actor->id, 403, 'You can only mark yourself absent.');
    }

    private function assertAttendanceNotSuspended(Teacher $actor, Carbon $now): void
    {
        if ($this->holidayBreaks->isAttendanceSuspended($actor, $now)) {
            throw ValidationException::withMessages([
                'session' => 'Attendance is currently suspended, so self-reported absence is unavailable.',
            ]);
        }
    }

    private function assertStaffSessionIsToday(TimeTable $timetable, Carbon $now): void
    {
        $day = $timetable->day_of_week ?? $timetable->day;
        if ($day && strcasecmp((string) $day, $now->format('l')) !== 0) {
            throw ValidationException::withMessages([
                'session' => 'You can only self-report absence for today’s assigned shift.',
            ]);
        }
    }

    private function assertCanSelfReport(
        TeacherAttendance|StaffAttendance|null $attendance,
        bool $isMissed,
        bool $isRescheduledAway = false,
    ): void {
        if (SelfReportedAbsence::isPermitted($attendance, $isMissed, $isRescheduledAway)) {
            return;
        }

        $message = match (true) {
            $isRescheduledAway => 'This session has been rescheduled, so self-reported absence is unavailable.',
            $attendance?->self_reported => 'You have already submitted a self-reported absence for this session.',
            $attendance?->isAbsenceLocked() => AttendanceLock::MESSAGE,
            (bool) $attendance?->check_in_time || (bool) $attendance?->check_out_time => 'You cannot mark yourself absent after checking in or checking out.',
            $isMissed => 'This session has already been marked as missed. Self-reported absence is no longer available.',
            default => 'Self-reported absence is not available for this attendance session.',
        };

        throw ValidationException::withMessages([
            'session' => $message,
        ]);
    }

    private function formatTimeRange(mixed $start, mixed $end): string
    {
        return $this->formatClock($start).' – '.$this->formatClock($end);
    }

    private function formatClock(mixed $time): string
    {
        if (! $time) {
            return '—';
        }

        try {
            return Carbon::parse((string) $time)->format('g:i A');
        } catch (\Throwable) {
            return (string) $time;
        }
    }

    /**
     * @param  list<string>  $roles
     */
    private function joinRoles(array $roles): string
    {
        if (count($roles) <= 1) {
            return $roles[0] ?? 'supervisor';
        }

        $last = array_pop($roles);

        return implode(', ', $roles).' and '.$last;
    }
}
