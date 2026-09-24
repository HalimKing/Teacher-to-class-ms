<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Concerns\EnforcesAttendanceGeofence;
use App\Http\Controllers\Controller;
use App\Models\StaffAttendance;
use App\Models\Teacher;
use App\Models\TimeTable;
use App\Services\ActivityLogService;
use App\Http\Requests\StoreSelfReportedAbsenceRequest;
use App\Services\AttendanceTimingService;
use App\Services\FacialRecognitionService;
use App\Services\HolidayBreakService;
use App\Services\SelfReportedAbsenceService;
use App\Services\VenueChangeAuthorizationService;
use App\Support\AttendanceExceptionCategory;
use App\Support\AttendanceLock;
use App\Support\SelfReportedAbsence;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class StaffAttendanceController extends Controller
{
    use EnforcesAttendanceGeofence;

    public function __construct(
        private AttendanceTimingService $timingService,
        private VenueChangeAuthorizationService $venueChangeAuthorization,
        private HolidayBreakService $holidayBreaks,
        private SelfReportedAbsenceService $selfReportedAbsences,
    ) {}

    public function createSelfReportedAbsence(TimeTable $timetable): Response|RedirectResponse
    {
        try {
            $session = $this->selfReportedAbsences->composeStaffForm(auth('teacher')->user(), $timetable);
        } catch (ValidationException $exception) {
            return redirect()
                ->route('teacher.staff-attendance')
                ->with('error', collect($exception->errors())->flatten()->first());
        }

        return Inertia::render('teacher/self-reported-absence/create', [
            'session' => $session,
        ]);
    }

    public function storeSelfReportedAbsence(StoreSelfReportedAbsenceRequest $request): RedirectResponse
    {
        $timetable = TimeTable::query()->findOrFail($request->validated('timetable_id'));

        try {
            [, $notify] = $this->selfReportedAbsences->submitForStaff(
                auth('teacher')->user(),
                $timetable,
                $request->validated(),
            );
        } catch (ValidationException $exception) {
            return back()
                ->withErrors($exception->errors())
                ->with('error', collect($exception->errors())->flatten()->first());
        }

        return redirect()
            ->route('teacher.staff-attendance')
            ->with('success', $this->selfReportedAbsences->successMessage($notify));
    }

    public function index(FacialRecognitionService $facialRecognition): Response
    {
        $teacher = auth('teacher')->user();
        $schedules = TimeTable::where('teacher_id', $teacher->id)
            ->where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR)
            ->with('classRoom')
            ->orderBy('day_of_week')
            ->orderBy('start_time')
            ->get();

        $today = now()->format('l');
        $date = now()->format('Y-m-d');

        return Inertia::render('teacher/staff-attendance', [
            'staffMember' => [
                'name' => trim("{$teacher->title} {$teacher->first_name} {$teacher->last_name}"),
                'email' => $teacher->email,
                'staff_type' => $teacher->staff_type,
                'faculty' => $teacher->faculty?->name,
                'department' => $teacher->department?->name,
            ],
            'assignedSchedules' => $schedules->map(fn (TimeTable $schedule) => $this->formatSchedule($schedule))->values(),
            'todaySchedules' => $schedules->where('day_of_week', $today)->map(function (TimeTable $schedule) use ($teacher, $date) {
                return $this->formatSchedule($schedule, $this->todayAttendanceFor($teacher->id, $schedule->id, $date));
            })->values(),
            'upcomingSchedules' => $schedules->filter(fn (TimeTable $schedule) => $this->isUpcoming($schedule))->map(fn (TimeTable $schedule) => $this->formatSchedule($schedule))->values(),
            'facialRecognitionEnabled' => $facialRecognition->isEnabled(),
        ]);
    }

    public function todaysSchedules(): JsonResponse
    {
        $staff = auth('teacher')->user();
        $today = now()->format('l');
        $date = now()->format('Y-m-d');

        if ($this->holidayBreaks->isAttendanceSuspended($staff, $date)) {
            return response()->json([
                'success' => true,
                'data' => [],
                'message' => 'Today\'s staff schedules fetched successfully.',
                'holiday_context' => $this->holidayBreaks->portalContext($staff, $date),
            ]);
        }

        $schedules = TimeTable::where('teacher_id', $staff->id)
            ->where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR)
            ->where('day_of_week', $today)
            ->with('classRoom')
            ->orderBy('start_time')
            ->get();

        $data = $schedules->map(function (TimeTable $schedule) use ($staff, $date) {
            return $this->formatSchedule($schedule, $this->todayAttendanceFor($staff->id, $schedule->id, $date));
        })->values();

        return response()->json([
            'success' => true,
            'data' => $data,
            'message' => 'Today\'s staff schedules fetched successfully.',
            'holiday_context' => $this->holidayBreaks->portalContext($staff, $date),
        ]);
    }

    public function checkIn(Request $request, FacialRecognitionService $facialRecognition): JsonResponse
    {
        $validated = $request->validate(array_merge([
            'timetable_id' => 'required|exists:time_tables,id',
            'check_in_time' => 'required|date',
            'coordinates.latitude' => 'required|numeric',
            'coordinates.longitude' => 'required|numeric',
            'coordinates.accuracy' => 'required|numeric',
            'coordinates.captured_at' => 'nullable',
            'distance' => 'required|numeric',
            'within_range' => 'required|boolean',
        ], $facialRecognition->attendanceValidationRules($facialRecognition->isEnabled())));

        $staff = auth('teacher')->user();
        $timetable = $this->getOwnedStaffTimetable((int) $validated['timetable_id'], $staff->id);

        if (! $timetable) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid staff schedule.',
            ], 404);
        }

        $now = Carbon::now();

        if ($this->holidayBreaks->isAttendanceSuspended($staff, $now)) {
            $context = $this->holidayBreaks->portalContext($staff, $now);

            return response()->json([
                'success' => false,
                'message' => $context['message'],
                'holiday_context' => $context,
            ], 422);
        }

        if (($timetable->day_of_week ?? $timetable->day) !== now()->format('l')) {
            return response()->json([
                'success' => false,
                'message' => 'This schedule is not assigned for today.',
            ], 400);
        }

        $scheduledStart = $this->timingService->parseScheduleTime((string) $timetable->start_time, $now);

        if (! $this->timingService->canCheckInNow($now, $scheduledStart, AttendanceTimingService::ROLE_ADMINISTRATOR)) {
            $allowedCheckIn = $this->timingService->getAllowedCheckInTime($scheduledStart);

            return response()->json([
                'success' => false,
                'message' => 'Attendance is not open yet. You can check in from '.$allowedCheckIn->format('h:i A').'.',
                'allowed_check_in_time' => $allowedCheckIn->format('H:i:s'),
            ], 400);
        }

        $checkInOutcome = $this->timingService->resolveCheckInOutcome($now, $scheduledStart, AttendanceTimingService::ROLE_ADMINISTRATOR);
        $today = $now->format('Y-m-d');
        $faceVerificationPayload = null;
        $faceMatchScore = null;

        $existingAttendance = $this->todayAttendanceFor($staff->id, $timetable->id, $today);

        if ($existingAttendance) {
            // A recorded absence closes the session: no check-in can follow it.
            if ($existingAttendance->isAbsenceLocked()) {
                return response()->json(AttendanceLock::blockedPayload(), 422);
            }

            if ($existingAttendance->check_out_time) {
                return response()->json([
                    'success' => false,
                    'message' => 'Attendance has already been completed for this work period.',
                ], 400);
            }

            return response()->json([
                'success' => true,
                'message' => 'You are already checked in for this work period.',
                'attendance_id' => $existingAttendance->id,
                'attendance' => $existingAttendance,
            ]);
        }

        $scheduledEnd = $this->timingService->parseScheduleTime((string) $timetable->end_time, $now);
        if ($this->timingService->hasCheckoutGraceExpired($now, $scheduledEnd)) {
            return response()->json(AttendanceLock::blockedPayload(), 422);
        }

        $activeAttendance = StaffAttendance::query()
            ->where('staff_id', $staff->id)
            ->whereDate('date', $today)
            ->activeCheckIn()
            ->first();

        if ($activeAttendance) {
            return response()->json([
                'success' => false,
                'message' => 'You already have an active staff check-in. Please check out first.',
            ], 400);
        }

        if ($facialRecognition->isEnabled()) {
            if (! $staff->hasFaceEnrollment()) {
                $facialRecognition->logAttempt($staff, (int) $validated['timetable_id'], 'failed', null, 'not_enrolled');

                return response()->json([
                    'success' => false,
                    'message' => 'Face enrollment is required before staff attendance can be marked.',
                ], 422);
            }

            $verifiedFace = $facialRecognition->resolveVerifiedAttendanceFace(
                $staff,
                (int) $validated['timetable_id'],
                (string) $request->input('face_verification_token', ''),
                $request->input('face_descriptor', []),
                $request->input('quality'),
            );

            if ($verifiedFace === null) {
                $facialRecognition->logAttempt($staff, (int) $validated['timetable_id'], 'failed', null, 'invalid_or_expired_token');

                return response()->json([
                    'success' => false,
                    'message' => 'Face verification failed. The captured face does not match the enrolled staff member.',
                ], 422);
            }

            $faceVerificationPayload = $verifiedFace['payload'];
            $faceMatchScore = $verifiedFace['score'];
        }

        $venueContext = $this->venueChangeAuthorization->resolveEffectiveVenue(
            $timetable,
            (int) $staff->id,
            $now,
            'check_in',
        );

        if ($locationFailure = $this->rejectUnlessInsideVenue($request, $venueContext['classroom'] ?? $timetable->classRoom, $staff->id, $timetable->id)) {
            return $locationFailure;
        }

        $validated['distance'] = $request->input('distance');
        $validated['within_range'] = $request->boolean('within_range');

        $effectiveClassroom = $venueContext['classroom'] ?? $timetable->classRoom;
        $authorization = $venueContext['authorization'];
        $breakMeta = $this->holidayBreaks->breakDutyMeta($staff, $now);
        $exceptionCategory = $venueContext['authorized_venue_used']
            ? AttendanceExceptionCategory::AUTHORIZED_VENUE_CHANGE
            : ($breakMeta['exception_category'] ?? AttendanceExceptionCategory::NORMAL);

        $attendance = StaffAttendance::create([
            'staff_id' => $staff->id,
            'timetable_id' => $timetable->id,
            'classroom_id' => $effectiveClassroom?->id ?? $timetable->class_room_id,
            'venue_change_authorization_id' => $authorization?->id,
            'authorized_venue_used' => (bool) $venueContext['authorized_venue_used'],
            'exception_category' => $exceptionCategory,
            'holiday_break_id' => $breakMeta['holiday_break_id'] ?? null,
            'academic_year_id' => $timetable->academic_year_id,
            'date' => $today,
            'check_in_time' => $now->format('H:i:s'),
            'latitude' => $validated['coordinates']['latitude'],
            'longitude' => $validated['coordinates']['longitude'],
            'check_in_distance' => $validated['distance'],
            'check_in_within_range' => $validated['within_range'],
            'attendance_status' => $checkInOutcome['attendance_status'],
            'arrival_category' => $checkInOutcome['arrival_category'],
            'minutes_early' => $checkInOutcome['minutes_early'],
            'minutes_late' => $checkInOutcome['minutes_late'],
            'face_verified' => $faceVerificationPayload !== null,
            'face_match_score' => $faceMatchScore ?? ($faceVerificationPayload['score'] ?? null),
            'face_verified_at' => $faceVerificationPayload ? now() : null,
        ]);

        app(ActivityLogService::class)->logAttendance(
            'attendance_check_in',
            'Staff attendance check-in recorded',
            metadata: [
                'attendance_id' => $attendance->id,
                'staff_id' => $staff->id,
                'within_range' => $validated['within_range'],
                'face_verified' => $faceVerificationPayload !== null,
            ],
        );

        return response()->json([
            'success' => true,
            'message' => $this->buildCheckInSuccessMessage($checkInOutcome),
            'attendance_id' => $attendance->id,
            'attendance' => $attendance,
            'arrival' => [
                'category' => $checkInOutcome['arrival_category'],
                'minutes_early' => $checkInOutcome['minutes_early'],
                'minutes_late' => $checkInOutcome['minutes_late'],
            ],
        ]);
    }

    public function checkOut(Request $request, FacialRecognitionService $facialRecognition): JsonResponse
    {
        $validated = $request->validate(array_merge([
            'attendance_id' => 'required|exists:staff_attendances,id',
            'check_out_time' => 'required|date',
            'coordinates.latitude' => 'required|numeric',
            'coordinates.longitude' => 'required|numeric',
            'coordinates.accuracy' => 'required|numeric',
            'coordinates.captured_at' => 'nullable',
            'distance' => 'required|numeric',
            'within_range' => 'required|boolean',
        ], $facialRecognition->attendanceValidationRules($facialRecognition->isEnabled())));

        $staff = auth('teacher')->user();
        $attendance = StaffAttendance::with('timetable')
            ->where('staff_id', $staff->id)
            ->find((int) $validated['attendance_id']);

        if (! $attendance) {
            return response()->json([
                'success' => false,
                'message' => 'Attendance record not found.',
            ], 404);
        }

        if ($attendance->check_out_time) {
            return response()->json([
                'success' => false,
                'message' => 'Already checked out.',
            ], 400);
        }

        // A recorded absence closes the session: no check-out can follow it.
        if ($attendance->isAbsenceLocked()) {
            return response()->json(AttendanceLock::blockedPayload(), 422);
        }

        if (! $attendance->check_in_time) {
            return response()->json([
                'success' => false,
                'message' => 'You have not checked in for this session yet.',
            ], 400);
        }

        if ($facialRecognition->isEnabled()) {
            if (! $staff->hasFaceEnrollment()) {
                $facialRecognition->logAttempt($staff, (int) $attendance->timetable_id, 'failed', null, 'not_enrolled');

                return response()->json([
                    'success' => false,
                    'message' => 'Face enrollment is required before staff check-out can be completed.',
                ], 422);
            }

            $verifiedFace = $facialRecognition->resolveVerifiedAttendanceFace(
                $staff,
                (int) $attendance->timetable_id,
                (string) $request->input('face_verification_token', ''),
                $request->input('face_descriptor', []),
                $request->input('quality'),
            );

            if ($verifiedFace === null) {
                $facialRecognition->logAttempt($staff, (int) $attendance->timetable_id, 'failed', null, 'invalid_or_expired_token');

                return response()->json([
                    'success' => false,
                    'message' => 'Face verification failed. The captured face does not match the enrolled staff member.',
                ], 422);
            }
        }

        $now = Carbon::now();
        $venueContext = $attendance->timetable
            ? $this->venueChangeAuthorization->resolveEffectiveVenue(
                $attendance->timetable,
                (int) $staff->id,
                $now,
                'check_out',
            )
            : ['classroom' => null, 'authorization' => null, 'authorized_venue_used' => false];

        if ($locationFailure = $this->rejectUnlessInsideVenue($request, $venueContext['classroom'] ?? $attendance->timetable?->classRoom, $staff->id, $attendance->timetable_id)) {
            return $locationFailure;
        }

        $validated['distance'] = $request->input('distance');
        $validated['within_range'] = $request->boolean('within_range');

        $scheduledEnd = $this->timingService->parseScheduleTime((string) $attendance->timetable?->end_time, $now);
        $checkOutOutcome = $this->timingService->resolveCheckOutOutcome(
            $now,
            $scheduledEnd,
            $attendance->attendance_status,
            AttendanceTimingService::ROLE_ADMINISTRATOR
        );

        $exceptionCategory = $attendance->exception_category;
        if ($checkOutOutcome['departure_category'] === 'early_leave') {
            $exceptionCategory = AttendanceExceptionCategory::UNAUTHORIZED_EARLY_DEPARTURE;
        } elseif ($venueContext['authorized_venue_used']) {
            $exceptionCategory = AttendanceExceptionCategory::AUTHORIZED_VENUE_CHANGE;
        }

        $attendance->update([
            'check_out_time' => $now->format('H:i:s'),
            'check_out_latitude' => $validated['coordinates']['latitude'],
            'check_out_longitude' => $validated['coordinates']['longitude'],
            'check_out_distance' => $validated['distance'],
            'check_out_within_range' => $validated['within_range'],
            'attendance_status' => $checkOutOutcome['attendance_status'],
            'departure_category' => $checkOutOutcome['departure_category'],
            'minutes_overtime' => $checkOutOutcome['minutes_overtime'],
            'venue_change_authorization_id' => $attendance->venue_change_authorization_id
                ?? $venueContext['authorization']?->id,
            'authorized_venue_used' => $attendance->authorized_venue_used || (bool) $venueContext['authorized_venue_used'],
            'exception_category' => $exceptionCategory,
        ]);

        app(ActivityLogService::class)->logAttendance(
            'attendance_check_out',
            'Staff attendance check-out recorded',
            metadata: [
                'attendance_id' => $attendance->id,
                'staff_id' => $attendance->staff_id,
                'within_range' => $validated['within_range'],
            ],
        );

        return response()->json([
            'success' => true,
            'message' => $this->buildCheckOutSuccessMessage($checkOutOutcome),
            'attendance' => $attendance->fresh(),
        ]);
    }

    public function history(Request $request): JsonResponse
    {
        $date = $request->filled('date')
            ? Carbon::parse($request->date)->format('Y-m-d')
            : now()->format('Y-m-d');

        $records = StaffAttendance::where('staff_id', auth('teacher')->id())
            ->whereDate('date', $date)
            ->with(['classroom', 'timetable'])
            ->orderByDesc('check_in_time')
            ->get()
            ->map(fn (StaffAttendance $attendance) => [
                'id' => $attendance->id,
                'timetable_id' => $attendance->timetable_id,
                'date' => $attendance->date?->format('Y-m-d'),
                'classroom' => $attendance->classroom?->name,
                'check_in_time' => $attendance->check_in_time,
                'check_out_time' => $attendance->check_out_time,
                'attendance_status' => $attendance->attendance_status,
                'arrival_category' => $attendance->arrival_category,
                'minutes_early' => $attendance->minutes_early,
                'minutes_late' => $attendance->minutes_late,
                'location_match' => $attendance->check_in_within_range,
            ]);

        return response()->json([
            'success' => true,
            'data' => $records,
        ]);
    }

    private function formatSchedule(TimeTable $schedule, ?StaffAttendance $attendance = null): array
    {
        $isToday = ($schedule->day_of_week ?? $schedule->day) === now()->format('l');
        $timing = $isToday
            ? $this->timingService->buildScheduleTiming(
                (string) $schedule->start_time,
                (string) $schedule->end_time,
                null,
                AttendanceTimingService::ROLE_ADMINISTRATOR
            )
            : [
                'early_checkin_minutes' => $this->timingService->getEarlyCheckInMinutes(AttendanceTimingService::ROLE_ADMINISTRATOR),
                'checkout_grace_period_minutes' => $this->timingService->getCheckoutGracePeriodMinutes(),
                'scheduled_start_time' => $schedule->start_time,
                'scheduled_start_time_display' => $this->timingService->parseScheduleTime((string) $schedule->start_time)->format('h:i A'),
                'allowed_check_in_time' => null,
                'allowed_check_in_time_display' => null,
                'can_check_in_now' => false,
                'minutes_until_check_in_opens' => null,
                'attendance_opens_message' => null,
            ];

        $venueContext = $isToday
            ? $this->venueChangeAuthorization->resolveEffectiveVenue(
                $schedule,
                (int) $schedule->teacher_id,
                now(),
                $attendance && ! $attendance->check_out_time ? 'check_out' : 'check_in',
            )
            : ['classroom' => $schedule->classRoom, 'authorization' => null, 'authorized_venue_used' => false];

        $displayClassroom = $venueContext['classroom'] ?? $schedule->classRoom;
        $authorization = $venueContext['authorization'];
        $isMissed = $attendance !== null && $attendance->isAbsenceLocked();
        $afterCheckoutGrace = (bool) ($timing['is_after_checkout_grace'] ?? false);

        if (
            ! $isMissed
            && $attendance === null
            && $isToday
            && $afterCheckoutGrace
        ) {
            $isMissed = true;
        }

        $canTakeAttendance = ! $isMissed;
        $attendanceBlockedMessage = $isMissed ? AttendanceLock::MESSAGE : null;

        return [
            'id' => $schedule->id,
            'classroom' => $displayClassroom?->name,
            'original_classroom' => $schedule->classRoom?->name,
            'day' => $schedule->day_of_week ?? $schedule->day,
            'start_time' => $schedule->start_time,
            'end_time' => $schedule->end_time,
            'coordinates' => [
                'lat' => $displayClassroom?->latitude,
                'lng' => $displayClassroom?->longitude,
            ],
            'radius' => $displayClassroom?->radius_meters ?? 0,
            'venue_authorization' => $authorization ? [
                'id' => $authorization->id,
                'authorization_type' => $authorization->authorization_type,
                'authorized_venue' => $authorization->authorizedClassroom?->name,
                'original_venue' => $authorization->originalClassroom?->name,
                'reason' => $authorization->reason,
                'start_date' => $authorization->start_date?->toDateString(),
                'end_date' => $authorization->end_date?->toDateString(),
                'period_label' => $authorization->period_label,
            ] : null,
            'attendance_taken' => $attendance !== null,
            'attendance_status' => $attendance ? [
                'id' => $attendance->id,
                'check_in_time' => $attendance->check_in_time,
                'check_out_time' => $attendance->check_out_time,
                'status' => $isMissed
                    ? 'absent'
                    : ($attendance->check_out_time ? 'completed' : 'checked_in'),
                'attendance_status' => $attendance->attendance_status,
                'arrival_category' => $attendance->arrival_category,
                'minutes_early' => $attendance->minutes_early,
                'minutes_late' => $attendance->minutes_late,
                'location_match' => $attendance->check_in_within_range,
                'exception_category' => $attendance->exception_category,
                'self_reported' => (bool) $attendance->self_reported,
            ] : null,
            'is_completed' => $attendance && $attendance->check_out_time !== null,
            'is_missed' => $isMissed,
            'can_take_attendance' => $canTakeAttendance,
            'can_self_report_absence' => SelfReportedAbsence::isPermitted($attendance, $isMissed),
            'self_reported' => (bool) $attendance?->self_reported,
            'attendance_blocked_message' => $attendanceBlockedMessage,
            'attendance_state' => $isMissed ? 'missed' : null,
            'needs_explanation' => $attendance
                && ! $attendance->self_reported
                && ! in_array($attendance->attendance_status, ['excused_absence'], true)
                && ! in_array($attendance->exception_category, [
                    AttendanceExceptionCategory::EXCUSED_ABSENCE,
                    AttendanceExceptionCategory::AUTHORIZED_EARLY_DEPARTURE,
                ], true)
                && (
                    $attendance->attendance_status === 'absent'
                    || $attendance->departure_category === 'early_leave'
                    || $attendance->attendance_status === 'early_leave'
                )
                && ! \App\Models\AttendanceExplanation::query()
                    ->where('attendance_type', 'staff')
                    ->where('attendance_id', $attendance->id)
                    ->whereIn('status', ['pending', 'approved'])
                    ->exists(),
            'timing' => $timing,
        ];
    }

    private function buildCheckOutSuccessMessage(array $checkOutOutcome): string
    {
        return match ($checkOutOutcome['departure_category']) {
            'early_leave' => 'Staff check-out recorded as early leave.',
            'overtime' => 'Staff check-out recorded as overtime ('.$checkOutOutcome['minutes_overtime'].' minute(s) after grace period).',
            default => 'Staff check-out successful.',
        };
    }

    private function buildCheckInSuccessMessage(array $checkInOutcome): string
    {
        return match ($checkInOutcome['arrival_category']) {
            'early' => 'Staff check-in successful. You checked in '.$checkInOutcome['minutes_early'].' minute(s) early.',
            'late' => 'Staff check-in recorded as late ('.$checkInOutcome['minutes_late'].' minute(s) after scheduled start).',
            default => 'Staff check-in successful. You are on time.',
        };
    }

    private function todayAttendanceFor(int $staffId, int $timetableId, string $date): ?StaffAttendance
    {
        return StaffAttendance::query()
            ->where('staff_id', $staffId)
            ->where('timetable_id', $timetableId)
            ->whereDate('date', $date)
            ->first();
    }

    private function getOwnedStaffTimetable(int $timetableId, int $staffId): ?TimeTable
    {
        return TimeTable::with('classRoom')
            ->where('id', $timetableId)
            ->where('teacher_id', $staffId)
            ->where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR)
            ->first();
    }

    private function isUpcoming(TimeTable $schedule): bool
    {
        $dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        $todayIndex = array_search(now()->format('l'), $dayOrder, true);
        $scheduleIndex = array_search($schedule->day_of_week ?? $schedule->day, $dayOrder, true);

        if ($scheduleIndex === false || $todayIndex === false) {
            return false;
        }

        if ($scheduleIndex > $todayIndex) {
            return true;
        }

        return $scheduleIndex === $todayIndex && $schedule->start_time > now()->format('H:i:s');
    }
}
