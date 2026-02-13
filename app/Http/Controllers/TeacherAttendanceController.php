<?php

namespace App\Http\Controllers;

use App\Models\AttendanceActivityLog;
use App\Models\Course;
use App\Models\SystemSetting;
use App\Models\TeacherAttendance;
use App\Models\TimeTable;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class TeacherAttendanceController extends Controller
{
    public function index()
    {
        // $Lectures = TimeTable::todaysLectures();
        // $teacherId = auth()->id();
        // $today = Carbon::now()->format('Y-m-d');

        // $todaysClasses = [];
        // foreach ($Lectures as $lecture) {
        //     // Check attendance status for this lecture
        //     $attendance = TeacherAttendance::where('teacher_id', $teacherId)
        //         ->where('timetable_id', $lecture->id)
        //         ->where('date', $today)
        //         ->first();

        //     $attendanceStatus = null;
        //     $attendanceTaken = false;

        //     if ($attendance) {
        //         $attendanceTaken = true;
        //         $attendanceStatus = [
        //             'id' => $attendance->id,
        //             'check_in_time' => $attendance->check_in_time,
        //             'check_out_time' => $attendance->check_out_time,
        //             'status' => $attendance->check_out_time ? 'completed' : 'checked_in',
        //             'location_match' => $attendance->check_in_within_range,
        //         ];
        //     }

        //     $todaysClasses[] = [
        //         'timetable_id' => $lecture->id,
        //         'id' => $lecture->course->id,
        //         'name' => $lecture->course->name,
        //         'code' => $lecture->course->course_code,
        //         'building' => $lecture->classroom->name,
        //         'room' => $lecture->classroom->room_number ?? 'N/A',
        //         'type' => 'lecture',
        //         'students' => $lecture->course->student_size,
        //         'start_time' => $lecture->start_time,
        //         'end_time' => $lecture->end_time,
        //         'coordinates' => [
        //             'lat' => $lecture->classroom->latitude,
        //             'lng' => $lecture->classroom->longitude,
        //         ],
        //         'radius' => $lecture->classroom->radius_meters,
        //         'attendance_taken' => $attendanceTaken,
        //         'attendance_status' => $attendanceStatus,
        //         'is_completed' => $attendance && $attendance->check_out_time !== null,
        //     ];
        // }

        return Inertia::render('teacher/attendance');
    }



    public function getTodaysClasses(Request $request)
    {
        $Lectures = TimeTable::todaysLectures();
        $teacherId = auth()->id();
        $today = Carbon::now()->format('Y-m-d');

        $todaysClasses = [];
        foreach ($Lectures as $lecture) {
            // Check attendance status for this lecture
            $attendance = TeacherAttendance::where('teacher_id', $teacherId)
                ->where('timetable_id', $lecture->id)
                ->where('date', $today)
                ->first();

            $attendanceStatus = null;
            $attendanceTaken = false;

            if ($attendance) {
                $attendanceTaken = true;
                $attendanceStatus = [
                    'id' => $attendance->id,
                    'check_in_time' => $attendance->check_in_time,
                    'check_out_time' => $attendance->check_out_time,
                    'status' => $attendance->check_out_time ? 'completed' : 'checked_in',
                    'location_match' => $attendance->check_in_within_range,
                ];
            }

            $todaysClasses[] = [
                'timetable_id' => $lecture->id,
                'id' => $lecture->course->id,
                'name' => $lecture->course->name,
                'code' => $lecture->course->course_code,
                'building' => $lecture->classroom->name,
                'room' => $lecture->classroom->room_number ?? 'N/A',
                'type' => 'lecture',
                'students' => $lecture->course->student_size,
                'start_time' => $lecture->start_time,
                'end_time' => $lecture->end_time,
                'coordinates' => [
                    'lat' => $lecture->classroom->latitude,
                    'lng' => $lecture->classroom->longitude,
                ],
                'radius' => $lecture->classroom->radius_meters,
                'attendance_taken' => $attendanceTaken,
                'attendance_status' => $attendanceStatus,
                'is_completed' => $attendance && $attendance->check_out_time !== null,
            ];
        }

        return response()->json([
            'success' => true,
            'data' => $todaysClasses,
            'message' => 'Today\'s classes fetched successfully'
        ]);
    }




    public function checkIn(Request $request)
    {
        // Validate request
        $request->validate([
            'coordinates.latitude' => 'required|numeric',
            'coordinates.longitude' => 'required|numeric',
            'coordinates.accuracy' => 'required|numeric',
            'course_id' => 'required|exists:courses,id',
            'course_name' => 'required|string',
            'class_room' => 'required|string',
            'timetable_id' => 'required|exists:time_tables,id',
            'check_in_time' => 'required|date',
            'distance' => 'required|numeric',
            'within_range' => 'required|boolean',
        ]);

        // Select from timetable where id = timetable_id
        $timetable = TimeTable::find($request->timetable_id);
        if (!$timetable) {
            return response()->json(['success' => false, 'message' => 'Invalid timetable ID'], 400);
        }

        // Check if the course_id matches the timetable's course_id
        if ($timetable->course_id != $request->course_id) {
            return response()->json(['success' => false, 'message' => 'Course ID does not match timetable'], 400);
        }

        // Check if user already has an active check-in for today
        $existingActiveAttendance = TeacherAttendance::where('teacher_id', auth()->id())
            ->where('date', Carbon::now()->format('Y-m-d'))
            ->whereNull('check_out_time')
            ->first();

        if ($existingActiveAttendance) {
            return response()->json([
                'success' => false,
                'message' => 'You already have an active check-in. Please check out first.'
            ], 400);
        }

        // Check if class start_time => current_time
        $classStartTime = Carbon::parse($timetable->start_time);
        if ($classStartTime->gt(Carbon::now())) {
            AttendanceActivityLog::logAttempt('attempt_failed', auth()->id(), (int) $request->timetable_id, [
                'reason' => 'class_not_started',
                'coordinates' => $request->coordinates,
                'distance' => $request->distance,
                'within_range' => $request->within_range,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Class has not started yet'
            ], 400);
        }

        // System setting: enforce GPS — reject if out of range
        $gpsEnforcement = SystemSetting::getValue('gps_enforcement_enabled', true);
        if ($gpsEnforcement && !$request->within_range) {
            AttendanceActivityLog::logAttempt('attempt_failed', auth()->id(), (int) $request->timetable_id, [
                'reason' => 'out_of_range',
                'coordinates' => $request->coordinates,
                'distance' => $request->distance,
                'within_range' => false,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'You are outside the allowed attendance location. Please move within range.'
            ], 400);
        }

        $now = Carbon::now();
        // Use lateCheckInMinute from request if provided, else fallback to system setting
        $lateMinutes = $request->has('lateCheckInMinute') ? (int) $request->lateCheckInMinute : (int) SystemSetting::getValue('late_check_in_minutes', 15);
        $lateThreshold = $classStartTime->copy()->addMinutes($lateMinutes);
        $status = $now->gt($lateThreshold) ? 'late' : 'pending';

        try {
            $attendance = new TeacherAttendance();
            $attendance->classroom_id = $timetable->class_room_id;
            $attendance->teacher_id = auth()->id();
            $attendance->course_id = $request->course_id;
            $attendance->timetable_id = $request->timetable_id;
            $attendance->academic_year_id = $timetable->academic_year_id;
            $attendance->date = $now->format('Y-m-d');
            $attendance->check_in_time = $now->format('h:i A');
            $attendance->check_in_latitude = $request->coordinates['latitude'];
            $attendance->check_in_longitude = $request->coordinates['longitude'];
            $attendance->check_in_distance = $request->distance;
            $attendance->check_in_within_range = $request->within_range;
            $attendance->status = $status;
            $attendance->check_in_status = $status === 'late' ? 'late' : 'present';

            $attendance->save();

            AttendanceActivityLog::logAttempt('check_in', auth()->id(), (int) $request->timetable_id, [
                'attendance_id' => $attendance->id,
                'coordinates' => $request->coordinates,
                'distance' => $request->distance,
                'within_range' => $request->within_range,
                'status' => $status,
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error during check-in: ' . $e->getMessage()], 500);
        }

        return response()->json([
            'success' => true,
            'message' => 'Check-in successful',
            'attendance_id' => $attendance->id,
            'attendance' => $attendance
        ]);
    }

    public function checkOut(Request $request)
    {
        $rules = [
            'attendance_id' => 'required|exists:teacher_attendances,id',
            'check_out_time' => 'required|date',
            'coordinates.latitude' => 'required|numeric',
            'coordinates.longitude' => 'required|numeric',
            'coordinates.accuracy' => 'required|numeric',
        ];
        if (SystemSetting::getValue('gps_enforcement_enabled', true)) {
            $rules['distance'] = 'required|numeric';
            $rules['within_range'] = 'required|boolean';
        }
        $request->validate($rules);

        // Find the attendance record
        $attendance = TeacherAttendance::find($request->attendance_id);

        // Verify the attendance belongs to the current teacher
        if ($attendance->teacher_id !== auth()->id()) {
            return response()->json([
                'success' => false,
                'message' => 'You are not authorized to check out this attendance record'
            ], 403);
        }

        // Check if already checked out
        if ($attendance->check_out_time !== null) {
            return response()->json([
                'success' => false,
                'message' => 'Already checked out'
            ], 400);
        }

        $timetable = TimeTable::find($attendance->timetable_id);
        $classEndTime = Carbon::parse($timetable->end_time);

        // Return if class is still on going
        if ($classEndTime->gt(Carbon::now())) {
            return response()->json([
                'success' => false,
                'message' => 'Class is still on going'
            ], 400);
        }

        $gpsEnforcement = SystemSetting::getValue('gps_enforcement_enabled', true);
        if ($gpsEnforcement && $request->has('within_range') && !$request->boolean('within_range')) {
            AttendanceActivityLog::logAttempt('attempt_failed', auth()->id(), (int) $attendance->timetable_id, [
                'reason' => 'check_out_out_of_range',
                'attendance_id' => $attendance->id,
                'coordinates' => $request->coordinates,
                'distance' => $request->input('distance'),
                'within_range' => false,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'You are outside the allowed attendance location for check-out.'
            ], 400);
        }

        $earlyLeaveMinutes = (int) SystemSetting::getValue('early_leave_minutes', 15);
        $earlyLeaveThreshold = $classEndTime->copy()->subMinutes($earlyLeaveMinutes);
        $now = Carbon::now();
        $status = $request->input('status', $attendance->status);
        if ($now->lt($earlyLeaveThreshold)) {
            $status = 'early_leave';
        } elseif ($attendance->status === 'pending' || $attendance->status === 'late') {
            $status = $attendance->status === 'late' ? 'late' : 'completed';
        }

        try {
            $attendance->check_out_time = $now->format('h:i A');
            $attendance->check_out_latitude = $request->coordinates['latitude'];
            $attendance->check_out_longitude = $request->coordinates['longitude'];
            $attendance->check_out_distance = $request->input('distance');
            $attendance->check_out_within_range = $request->boolean('within_range', true);
            $attendance->status = $status;
            $attendance->save();

            AttendanceActivityLog::logAttempt('check_out', auth()->id(), (int) $attendance->timetable_id, [
                'attendance_id' => $attendance->id,
                'coordinates' => $request->coordinates,
                'distance' => $request->input('distance'),
                'within_range' => $request->boolean('within_range', true),
                'status' => $status,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error during check-out: ' . $e->getMessage()
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => 'Check-out successful',
            'attendance' => $attendance
        ]);
    }

    public function getAttendanceHistory(Request $request)
    {
        // Get date from request or use today
        $date = $request->has('date')
            ? Carbon::parse($request->date)->format('Y-m-d')
            : Carbon::now()->format('Y-m-d');

        $attendance = TeacherAttendance::where('teacher_id', auth()->id())
            ->where('date', $date)
            ->with(['course', 'classroom'])
            ->orderBy('check_in_time', 'desc')
            ->get();

        $todayAttendance = [];
        foreach ($attendance as $today) {
            $todayAttendance[] = [
                'id' => $today->id,
                'timetable_id' => $today->timetable_id,
                'course_id' => $today->course_id,
                'date' => $today->date,
                'course_name' => $today->course->name,
                'class_room' => $today->classroom->name,
                'room_number' => $today->classroom->room_number ?? 'N/A',
                'check_in_time' => $today->check_in_time,
                'check_out_time' => $today->check_out_time,
                'check_in_latitude' => $today->check_in_latitude,
                'check_in_longitude' => $today->check_in_longitude,
                'check_out_latitude' => $today->check_out_latitude,
                'check_out_longitude' => $today->check_out_longitude,
                'check_in_distance' => $today->check_in_distance,
                'status' => $today->status ?? 'present',
                'location_match' => $today->check_in_within_range,
                'coordinates' => $today->check_in_latitude && $today->check_in_longitude
                    ? ['lat' => (float)$today->check_in_latitude, 'lng' => (float)$today->check_in_longitude]
                    : null
            ];
        }

        return response()->json(['success' => true, 'data' => $todayAttendance]);
    }

    // Optional: Add endpoint to get specific attendance by timetable_id
    public function getAttendanceByTimetable($timetableId)
    {
        $attendance = TeacherAttendance::where('teacher_id', auth()->id())
            ->where('timetable_id', $timetableId)
            ->where('date', Carbon::now()->format('Y-m-d'))
            ->with(['course', 'classroom'])
            ->first();

        if (!$attendance) {
            return response()->json(['success' => false, 'message' => 'No attendance record found'], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $attendance->id,
                'timetable_id' => $attendance->timetable_id,
                'course_id' => $attendance->course_id,
                'date' => $attendance->date,
                'course_name' => $attendance->course->name,
                'class_room' => $attendance->classroom->name,
                'check_in_time' => $attendance->check_in_time,
                'check_out_time' => $attendance->check_out_time,
                'status' => $attendance->status ?? 'present',
                'location_match' => $attendance->check_in_within_range,
            ]
        ]);
    }

    /**
     * Get attendance records for the teacher with filtering
     */
    public function getAttendanceRecords(Request $request)
    {
        try {
            $query = TeacherAttendance::where('teacher_id', auth()->id())
                ->with(['timetable', 'course', 'classroom'])
                ->orderBy('date', 'desc')
                ->orderBy('check_in_time', 'desc');

            // Date range filter
            $dateRange = $request->get('dateRange', 'last-30-days');
            $startDate = Carbon::now();

            switch ($dateRange) {
                case 'today':
                    $startDate = Carbon::now()->startOfDay();
                    break;
                case 'last-7-days':
                    $startDate = Carbon::now()->subDays(7);
                    break;
                case 'last-30-days':
                    $startDate = Carbon::now()->subDays(30);
                    break;
                case 'this-month':
                    $startDate = Carbon::now()->startOfMonth();
                    break;
                case 'last-month':
                    $startDate = Carbon::now()->subMonth()->startOfMonth();
                    break;
            }

            if ($dateRange !== 'custom') {
                $query->where('date', '>=', $startDate->toDateString());
            } else if ($request->has('startDate') && $request->has('endDate')) {
                $query->whereBetween('date', [
                    Carbon::parse($request->get('startDate'))->toDateString(),
                    Carbon::parse($request->get('endDate'))->toDateString()
                ]);
            }

            // Course filter
            if ($request->has('courseId') && $request->get('courseId') !== 'all') {
                $query->where('course_id', $request->get('courseId'));
            }

            // Status filter
            if ($request->has('status') && $request->get('status') !== 'all') {
                $query->where('status', $request->get('status'));
            }

            // Search filter
            if ($request->has('search') && $request->get('search') !== '') {
                $search = $request->get('search');
                $query->whereHas(
                    'course',
                    fn($q) =>
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('course_code', 'like', "%{$search}%")
                );
            }

            $records = $query->paginate(15);

            // Format records for frontend using transform instead of map
            $records->getCollection()->transform(function ($record) {
                // Get course info - prefer direct course relationship
                $course = $record->course;

                // Fallback to timetable course if direct course is not available
                if (!$course && $record->timetable) {
                    $course = $record->timetable->course;
                }

                // Get time from timetable
                $time = 'N/A';
                if ($record->timetable) {
                    $startTime = Carbon::parse($record->timetable->start_time);
                    $endTime = Carbon::parse($record->timetable->end_time);
                    $time = $startTime->format('g:i A') . ' - ' . $endTime->format('g:i A');
                }

                $record->date_formatted = Carbon::parse($record->date)->format('M d, Y');
                $record->day_of_week = Carbon::parse($record->date)->format('l');
                $record->course_name = $course?->name ?? 'Unknown Course';
                $record->course_code = $course?->course_code ?? 'N/A';
                $record->course_id = $course?->id ?? 0;
                $record->class_time = $time;
                $record->total_students = $course?->student_size ?? 0;
                $record->present_count = 0;
                $record->absent_count = 0;
                $record->late_count = 0;
                $record->attendance_rate = 100;
                $record->taken_by = auth()->user()->first_name . ' ' . auth()->user()->last_name;

                return $record;
            });

            // Get summary statistics
            $allRecords = TeacherAttendance::where('teacher_id', auth()->id())->get();
            $stats = [
                'totalSessions' => $allRecords->count(),
                'averageAttendance' => 92.3,
                'totalStudents' => $this->getTotalStudents(),
                'absentRate' => 7.7,
            ];

            return response()->json([
                'success' => true,
                'data' => $records->items(),
                'pagination' => [
                    'total' => $records->total(),
                    'per_page' => $records->perPage(),
                    'current_page' => $records->currentPage(),
                    'last_page' => $records->lastPage(),
                    'from' => $records->firstItem(),
                    'to' => $records->lastItem(),
                ],
                'stats' => $stats,
                'courses' => $this->getTeacherCourses(),
            ]);
        } catch (\Exception $e) {
            \Log::error('Error fetching attendance records: ' . $e->getMessage(), [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error fetching attendance records: ' . $e->getMessage(),
                'data' => [],
                'pagination' => [
                    'total' => 0,
                    'per_page' => 15,
                    'current_page' => 1,
                    'last_page' => 0,
                    'from' => 0,
                    'to' => 0,
                ],
                'stats' => [
                    'totalSessions' => 0,
                    'averageAttendance' => 0,
                    'totalStudents' => 0,
                    'absentRate' => 0,
                ],
                'courses' => [],
            ], 500);
        }
    }

    /**
     * Get total students across all courses
     */
    private function getTotalStudents()
    {
        $courses = Course::where('teacher_id', auth()->id())->get();
        return $courses->sum('student_size') ?? 0;
    }

    /**
     * Get courses for the teacher
     */
    private function getTeacherCourses()
    {
        return Course::where('teacher_id', auth()->id())
            ->select('id', 'name', 'course_code')
            ->get()
            ->map(fn($course) => [
                'id' => $course->id,
                'name' => $course->name,
                'code' => $course->course_code,
            ])
            ->toArray();
    }
}
