<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\StaffAttendance;
use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Models\TimeTable;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StaffAttendanceController extends Controller
{
    public function index(): Response
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
                ->where('date', $date)
                ->first();

            return $this->formatSchedule($schedule, $attendance);
        })->values();

        return response()->json([
            'success' => true,
            'data' => $data,
            'message' => 'Today\'s staff schedules fetched successfully.',
        ]);
    }

    public function checkIn(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'timetable_id' => 'required|exists:time_tables,id',
            'check_in_time' => 'required|date',
            'coordinates.latitude' => 'required|numeric',
            'coordinates.longitude' => 'required|numeric',
            'coordinates.accuracy' => 'required|numeric',
            'distance' => 'required|numeric',
            'within_range' => 'required|boolean',
        ]);

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

        $activeAttendance = StaffAttendance::where('staff_id', $staff->id)
            ->where('date', now()->format('Y-m-d'))
            ->whereNull('check_out_time')
            ->first();

        if ($activeAttendance) {
            return response()->json([
                'success' => false,
                'message' => 'You already have an active staff check-in. Please check out first.',
            ], 400);
        }

        $gpsEnforcement = SystemSetting::getValue('gps_enforcement_enabled', true);
        if ($gpsEnforcement && !$request->boolean('within_range')) {
            return response()->json([
                'success' => false,
                'message' => 'You are outside the allowed attendance location. Please move within range.',
            ], 400);
        }

        $now = Carbon::now();
        $startTime = Carbon::parse($timetable->start_time);
        $lateMinutes = (int) SystemSetting::getValue('late_check_in_minutes', 15);
        $status = $now->gt($startTime->copy()->addMinutes($lateMinutes)) ? 'late' : 'checked_in';

        $attendance = StaffAttendance::create([
            'staff_id' => $staff->id,
            'timetable_id' => $timetable->id,
            'classroom_id' => $timetable->class_room_id,
            'academic_year_id' => $timetable->academic_year_id,
            'date' => $now->format('Y-m-d'),
            'check_in_time' => $now->format('H:i:s'),
            'latitude' => $validated['coordinates']['latitude'],
            'longitude' => $validated['coordinates']['longitude'],
            'check_in_distance' => $validated['distance'],
            'check_in_within_range' => $validated['within_range'],
            'attendance_status' => $status,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Staff check-in successful.',
            'attendance_id' => $attendance->id,
            'attendance' => $attendance,
        ]);
    }

    public function checkOut(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'attendance_id' => 'required|exists:staff_attendances,id',
            'check_out_time' => 'required|date',
            'coordinates.latitude' => 'required|numeric',
            'coordinates.longitude' => 'required|numeric',
            'coordinates.accuracy' => 'required|numeric',
            'distance' => 'required|numeric',
            'within_range' => 'required|boolean',
        ]);

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

        $gpsEnforcement = SystemSetting::getValue('gps_enforcement_enabled', true);
        if ($gpsEnforcement && !$request->boolean('within_range')) {
            return response()->json([
                'success' => false,
                'message' => 'You are outside the allowed attendance location for check-out.',
            ], 400);
        }

        $now = Carbon::now();
        $endTime = Carbon::parse($attendance->timetable?->end_time);
        $earlyLeaveMinutes = (int) SystemSetting::getValue('early_leave_minutes', 15);
        $status = $now->lt($endTime->copy()->subMinutes($earlyLeaveMinutes)) ? 'early_leave' : 'completed';

        $attendance->update([
            'check_out_time' => $now->format('H:i:s'),
            'check_out_latitude' => $validated['coordinates']['latitude'],
            'check_out_longitude' => $validated['coordinates']['longitude'],
            'check_out_distance' => $validated['distance'],
            'check_out_within_range' => $validated['within_range'],
            'attendance_status' => $status,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Staff check-out successful.',
            'attendance' => $attendance->fresh(),
        ]);
    }

    public function history(Request $request): JsonResponse
    {
        $date = $request->filled('date')
            ? Carbon::parse($request->date)->format('Y-m-d')
            : now()->format('Y-m-d');

        $records = StaffAttendance::where('staff_id', auth('teacher')->id())
            ->where('date', $date)
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
                'location_match' => $attendance->check_in_within_range,
            ]);

        return response()->json([
            'success' => true,
            'data' => $records,
        ]);
    }

    private function formatSchedule(TimeTable $schedule, ?StaffAttendance $attendance = null): array
    {
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
                'location_match' => $attendance->check_in_within_range,
            ] : null,
            'is_completed' => $attendance && $attendance->check_out_time !== null,
        ];
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
