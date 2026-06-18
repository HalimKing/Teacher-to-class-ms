<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\StaffAttendance;
use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Models\TimeTable;
use App\Services\FacialRecognitionService;
use App\Services\AttendanceTimingService;
use App\Services\ActivityLogService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StaffAttendanceController extends Controller
{
    public function __construct(
        private AttendanceTimingService $timingService
    ) {}

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

        return Inertia::render('teacher/staff-attendance', [
            'staffMember' => [
                'name' => trim("{$teacher->title} {$teacher->first_name} {$teacher->last_name}"),
                'email' => $teacher->email,
                'staff_type' => $teacher->staff_type,
                'faculty' => $teacher->faculty?->name,
                'department' => $teacher->department?->name,
            ],
            'assignedSchedules' => $schedules->map(fn (TimeTable $schedule) => $this->formatSchedule($schedule))->values(),
            'todaySchedules' => $schedules->where('day_of_week', $today)->map(fn (TimeTable $schedule) => $this->formatSchedule($schedule))->values(),
            'upcomingSchedules' => $schedules->filter(fn (TimeTable $schedule) => $this->isUpcoming($schedule))->map(fn (TimeTable $schedule) => $this->formatSchedule($schedule))->values(),
            'facialRecognitionEnabled' => $facialRecognition->isEnabled(),
        ]);
    }

    public function todaysSchedules(): JsonResponse
    {
        $staff = auth('teacher')->user();
        $today = now()->format('l');
        $date = now()->format('Y-m-d');

        $schedules = TimeTable::where('teacher_id', $staff->id)
            ->where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR)
            ->where('day_of_week', $today)
            ->with('classRoom')
            ->orderBy('start_time')
            ->get();

        $data = $schedules->map(function (TimeTable $schedule) use ($staff, $date) {
            $attendance = StaffAttendance::where('staff_id', $staff->id)
                ->where('timetable_id', $schedule->id)
                ->whereDate('date', $date)
                ->first();

            return $this->formatSchedule($schedule, $attendance);
        })->values();

        return response()->json([
            'success' => true,
            'data' => $data,
            'message' => 'Today\'s staff schedules fetched successfully.',
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
            'distance' => 'required|numeric',
            'within_range' => 'required|boolean',
        ], $facialRecognition->attendanceValidationRules($facialRecognition->isEnabled())));

        $staff = auth('teacher')->user();
        $timetable = $this->getOwnedStaffTimetable((int) $validated['timetable_id'], $staff->id);

        if (!$timetable) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid staff schedule.',
            ], 404);
        }

        if (($timetable->day_of_week ?? $timetable->day) !== now()->format('l')) {
            return response()->json([
                'success' => false,
                'message' => 'This schedule is not assigned for today.',
            ], 400);
        }

        $now = Carbon::now();
        $scheduledStart = $this->timingService->parseScheduleTime((string) $timetable->start_time, $now);

        if (!$this->timingService->canCheckInNow($now, $scheduledStart, AttendanceTimingService::ROLE_ADMINISTRATOR)) {
            $allowedCheckIn = $this->timingService->getAllowedCheckInTime($scheduledStart);

            return response()->json([
                'success' => false,
                'message' => 'Attendance is not open yet. You can check in from ' . $allowedCheckIn->format('h:i A') . '.',
                'allowed_check_in_time' => $allowedCheckIn->format('H:i:s'),
            ], 400);
        }

        $checkInOutcome = $this->timingService->resolveCheckInOutcome($now, $scheduledStart, AttendanceTimingService::ROLE_ADMINISTRATOR);
        $today = $now->format('Y-m-d');
        $faceVerificationPayload = null;
        $faceMatchScore = null;

        $existingAttendance = StaffAttendance::where('staff_id', $staff->id)
            ->where('timetable_id', $timetable->id)
            ->whereDate('date', $today)
            ->first();

        if ($existingAttendance) {
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

        $activeAttendance = StaffAttendance::where('staff_id', $staff->id)
            ->whereDate('date', $today)
            ->whereNull('check_out_time')
            ->first();

        if ($activeAttendance) {
            return response()->json([
                'success' => false,
                'message' => 'You already have an active staff check-in. Please check out first.',
            ], 400);
        }

        if ($facialRecognition->isEnabled()) {
            if (!$staff->hasFaceEnrollment()) {
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

        $gpsEnforcement = SystemSetting::getValue('gps_enforcement_enabled', true);
        if ($gpsEnforcement && !$request->boolean('within_range')) {
            return response()->json([
                'success' => false,
                'message' => 'You are outside the allowed attendance location. Please move within range.',
            ], 400);
        }

        $attendance = StaffAttendance::create([
            'staff_id' => $staff->id,
            'timetable_id' => $timetable->id,
            'classroom_id' => $timetable->class_room_id,
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
            'distance' => 'required|numeric',
            'within_range' => 'required|boolean',
        ], $facialRecognition->attendanceValidationRules($facialRecognition->isEnabled())));

        $staff = auth('teacher')->user();
        $attendance = StaffAttendance::with('timetable')
            ->where('staff_id', $staff->id)
            ->find((int) $validated['attendance_id']);

        if (!$attendance) {
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

        if ($facialRecognition->isEnabled()) {
            if (!$staff->hasFaceEnrollment()) {
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

        $gpsEnforcement = SystemSetting::getValue('gps_enforcement_enabled', true);
        if ($gpsEnforcement && !$request->boolean('within_range')) {
            return response()->json([
                'success' => false,
                'message' => 'You are outside the allowed attendance location for check-out.',
            ], 400);
        }

        $now = Carbon::now();
        $scheduledEnd = $this->timingService->parseScheduleTime((string) $attendance->timetable?->end_time, $now);
        $checkOutOutcome = $this->timingService->resolveCheckOutOutcome(
            $now,
            $scheduledEnd,
            $attendance->attendance_status,
            AttendanceTimingService::ROLE_ADMINISTRATOR
        );

        $attendance->update([
            'check_out_time' => $now->format('H:i:s'),
            'check_out_latitude' => $validated['coordinates']['latitude'],
            'check_out_longitude' => $validated['coordinates']['longitude'],
            'check_out_distance' => $validated['distance'],
            'check_out_within_range' => $validated['within_range'],
            'attendance_status' => $checkOutOutcome['attendance_status'],
            'departure_category' => $checkOutOutcome['departure_category'],
            'minutes_overtime' => $checkOutOutcome['minutes_overtime'],
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

        return [
            'id' => $schedule->id,
            'classroom' => $schedule->classRoom?->name,
            'day' => $schedule->day_of_week ?? $schedule->day,
            'start_time' => $schedule->start_time,
            'end_time' => $schedule->end_time,
            'coordinates' => [
                'lat' => $schedule->classRoom?->latitude,
                'lng' => $schedule->classRoom?->longitude,
            ],
            'radius' => $schedule->classRoom?->radius_meters ?? 0,
            'attendance_taken' => $attendance !== null,
            'attendance_status' => $attendance ? [
                'id' => $attendance->id,
                'check_in_time' => $attendance->check_in_time,
                'check_out_time' => $attendance->check_out_time,
                'status' => $attendance->check_out_time ? 'completed' : 'checked_in',
                'attendance_status' => $attendance->attendance_status,
                'arrival_category' => $attendance->arrival_category,
                'minutes_early' => $attendance->minutes_early,
                'minutes_late' => $attendance->minutes_late,
                'location_match' => $attendance->check_in_within_range,
            ] : null,
            'is_completed' => $attendance && $attendance->check_out_time !== null,
            'timing' => $timing,
        ];
    }

    private function buildCheckOutSuccessMessage(array $checkOutOutcome): string
    {
        return match ($checkOutOutcome['departure_category']) {
            'early_leave' => 'Staff check-out recorded as early leave.',
            'overtime' => 'Staff check-out recorded as overtime (' . $checkOutOutcome['minutes_overtime'] . ' minute(s) after grace period).',
            default => 'Staff check-out successful.',
        };
    }

    private function buildCheckInSuccessMessage(array $checkInOutcome): string
    {
        return match ($checkInOutcome['arrival_category']) {
            'early' => 'Staff check-in successful. You checked in ' . $checkInOutcome['minutes_early'] . ' minute(s) early.',
            'late' => 'Staff check-in recorded as late (' . $checkInOutcome['minutes_late'] . ' minute(s) after scheduled start).',
            default => 'Staff check-in successful. You are on time.',
        };
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
