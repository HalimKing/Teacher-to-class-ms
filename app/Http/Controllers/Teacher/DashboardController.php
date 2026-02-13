<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\Course;
use App\Models\TeacherAttendance;
use App\Models\TimeTable;
use Carbon\Carbon;
use DateTime;
use Illuminate\Http\Request;
use ZipStream\Time;

class DashboardController extends Controller
{
    //

    public function index()
    {
        $todayLectures = TimeTable::with('course.teacher', 'classroom', 'course.program', 'course.level')
            ->where('day', now()->format('l'))
            ->whereHas('course', fn($q) => $q->where('teacher_id', auth()->id()))
            ->orderBy('start_time')
            ->get();

        $upcomingClasses = [];
        foreach ($todayLectures as $lecture) {
            $startTime = new DateTime($lecture->start_time);
            $endTime = new DateTime($lecture->end_time);
            $interval = $startTime->diff($endTime);

            $status = 'upcoming';
            if ($startTime <= now() && $endTime >= now()) {
                $status = 'ongoing';
            } else if ($startTime < now()) {
                $status = 'finished';
            } else if ($startTime > now()) {
                $status = 'upcoming';
            } else {
                $status = 'pending';
            }

            $upcomingClasses[] = [
                'id' => $lecture->course->id,
                'course' => $lecture->course->name,
                'code' => $lecture->course->course_code,
                'program' => $lecture->course->program->name,
                'level' => $lecture->course->level->name,
                'room' => $lecture->classroom->name,
                'type' => 'lecture',
                'students' => $lecture->course->student_size,
                'start_time' => $lecture->start_time,
                'end_time' => $lecture->end_time,
                'duration' => $interval->format('%h hours %i minutes'),
                'status' => $status,
            ];
        }

        // Get attendance rate data
        $attendanceData = $this->getAttendanceRateData('week');

        // Get metrics data
        $metricsData = $this->getMetricsData();

        // Get teacher profile data
        $profileData = $this->getTeacherProfileData();

        // For debugging
        // dd($upcomingClasses);

        return inertia('teacher/dashboard', [
            'todayLectures' => $upcomingClasses,
            'upcomingClasses' => $upcomingClasses,
            'attendanceData' => $attendanceData,
            'metricsData' => $metricsData,
            'profileData' => $profileData
        ]);
    }

    /**
     * Get attendance rate data via API
     */
    public function getAttendanceData(Request $request)
    {
        $timeRange = $request->query('timeRange', 'week');
        $data = $this->getAttendanceRateData($timeRange);

        return response()->json($data);
    }

    /**
     * Get attendance rate data for specified time range
     */
    private function getAttendanceRateData($timeRange = 'week')
    {
        $teacherId = auth()->id();
        $now = Carbon::now();

        switch ($timeRange) {
            case 'today':
                $startDate = $now->clone()->startOfDay();
                $endDate = $now->clone()->endOfDay();
                $labels = [];
                $attendanceRates = [];

                // Get hourly attendance for today
                for ($hour = 6; $hour <= 18; $hour++) {
                    $hourStart = $now->clone()->setHour($hour)->startOfHour();
                    $hourEnd = $now->clone()->setHour($hour)->endOfHour();

                    $labels[] = $hourStart->format('g A');
                    $rate = $this->calculateAttendanceRateForPeriod($teacherId, $hourStart, $hourEnd);
                    $attendanceRates[] = $rate;
                }
                break;

            case 'week':
                $startDate = $now->clone()->startOfWeek();
                $endDate = $now->clone()->endOfWeek();
                $labels = [];
                $attendanceRates = [];

                // Get daily attendance for this week
                for ($i = 0; $i < 7; $i++) {
                    $date = $startDate->clone()->addDays($i);
                    $labels[] = $date->format('D');
                    $rate = $this->calculateAttendanceRateForPeriod($teacherId, $date->startOfDay(), $date->endOfDay());
                    $attendanceRates[] = $rate;
                }
                break;

            case 'month':
                $startDate = $now->clone()->startOfMonth();
                $endDate = $now->clone()->endOfMonth();
                $labels = [];
                $attendanceRates = [];

                // Get weekly attendance for this month
                $weeks = $now->daysInMonth / 7;
                for ($i = 0; $i < ceil($weeks); $i++) {
                    $weekStart = $startDate->clone()->addWeeks($i);
                    $weekEnd = $weekStart->clone()->addWeek();

                    if ($weekStart->month != $now->month) {
                        break;
                    }

                    $labels[] = 'Week ' . ($i + 1);
                    $rate = $this->calculateAttendanceRateForPeriod($teacherId, $weekStart->startOfDay(), $weekEnd->endOfDay());
                    $attendanceRates[] = $rate;
                }
                break;

            case 'semester':
            default:
                $startDate = $now->clone()->startOfMonth();
                $endDate = $now->clone()->endOfMonth();
                $labels = [];
                $attendanceRates = [];

                // Get daily attendance for current month (assuming semester is a month)
                $daysInMonth = $now->daysInMonth;
                for ($i = 0; $i < $daysInMonth; $i++) {
                    $date = $startDate->clone()->addDays($i);
                    if ($i % 5 == 0) { // Show every 5th day to avoid crowding
                        $labels[] = $date->format('M d');
                        $rate = $this->calculateAttendanceRateForPeriod($teacherId, $date->startOfDay(), $date->endOfDay());
                        $attendanceRates[] = $rate;
                    }
                }
                break;
        }

        return [
            'labels' => $labels,
            'attendance' => $attendanceRates
        ];
    }

    /**
     * Calculate attendance rate for a specific period
     */
    private function calculateAttendanceRateForPeriod($teacherId, $startDate, $endDate)
    {
        // Get all unique timetable IDs for this teacher
        $timetableIds = TimeTable::whereHas('course', fn($q) => $q->where('teacher_id', $teacherId))
            ->pluck('id')
            ->toArray();

        if (count($timetableIds) == 0) {
            return 0;
        }

        // Get expected attendance records (timetables that should have occurred in this period)
        $expectedAttendanceCount = 0;
        foreach ($timetableIds as $timetableId) {
            $timetable = TimeTable::find($timetableId);

            // Count how many times this class should occur in the period
            $dayName = $timetable->day;
            $currentDate = $startDate->clone();

            while ($currentDate <= $endDate) {
                if ($currentDate->format('l') === $dayName) {
                    $expectedAttendanceCount++;
                }
                $currentDate->addDay();
            }
        }

        if ($expectedAttendanceCount == 0) {
            return 0;
        }

        // Count actual attendance records
        $actualAttendanceCount = TeacherAttendance::where('teacher_id', $teacherId)
            ->whereIn('timetable_id', $timetableIds)
            ->whereBetween('date', [$startDate->toDateString(), $endDate->toDateString()])
            ->count();

        $rate = round(($actualAttendanceCount / $expectedAttendanceCount) * 100);
        return min($rate, 100); // Ensure rate doesn't exceed 100%
    }

    /**
     * Get metrics data for dashboard
     */
    private function getMetricsData()
    {
        $teacherId = auth()->id();
        $today = Carbon::now();

        // Total Classes Assigned
        $totalClasses = Course::where('teacher_id', $teacherId)
        ->whereHas('timeTables', function ($query) {
                $query->where('academic_year_id', AcademicYear::current()->id);
            })
            ->count();

        // Today's lectures
        $todayLectures = TimeTable::where('day', $today->format('l'))
            ->whereHas('course', fn($q) => $q->where('teacher_id', $teacherId))
            ->get();

        // Attendance taken today
        $attendanceTakenToday = TeacherAttendance::where('teacher_id', $teacherId)
            ->where('date', $today->toDateString())
            ->count();

        // Pending attendance (finished classes without attendance)
        $pendingAttendance = 0;
        foreach ($todayLectures as $lecture) {
            $startTime = new DateTime($lecture->start_time);
            if ($startTime < $today) {
                // Class has finished
                $hasAttendance = TeacherAttendance::where('teacher_id', $teacherId)
                    ->where('timetable_id', $lecture->id)
                    ->where('date', $today->toDateString())
                    ->exists();

                if (!$hasAttendance) {
                    $pendingAttendance++;
                }
            }
        }

        // Total attendance records
        $totalRecords = TeacherAttendance::where('teacher_id', $teacherId)
            ->count();

        return [
            'totalClasses' => $totalClasses,
            'attendanceTodayCount' => $attendanceTakenToday,
            'attendanceTodayTarget' => count($todayLectures),
            'pendingAttendance' => $pendingAttendance,
            'totalRecords' => $totalRecords,
        ];
    }

    /**
     * Get teacher profile data
     */
    private function getTeacherProfileData()
    {
        $teacher = auth()->user()->load('faculty', 'department', 'courses');

        // Calculate total students
        $totalStudents = 0;
        foreach ($teacher->courses as $course) {
            $totalStudents += $course->student_size ?? 0;
        }

        // Get next class from today's lectures
        $todayLectures = TimeTable::with('course')
            ->where('day', now()->format('l'))
            ->whereHas('course', fn($q) => $q->where('teacher_id', auth()->id()))
            ->orderBy('start_time')
            ->get();

        $nextClass = 'No classes scheduled';
        foreach ($todayLectures as $lecture) {
            $startTime = new DateTime($lecture->start_time);
            if ($startTime >= now()) {
                $nextClass = $lecture->course->name . ' - ' . $startTime->format('g:i A');
                break;
            }
        }

        // Get primary course/subject
        $primarySubject = 'Not assigned';
        if ($teacher->courses->count() > 0) {
            $primarySubject = $teacher->courses->first()->name;
        }

        return [
            'name' => $teacher->first_name . ' ' . $teacher->last_name,
            'email' => $teacher->email,
            'phone' => $teacher->phone ?? 'Not provided',
            'title' => $teacher->title ?? 'Teacher',
            'subject' => $primarySubject,
            'faculty' => $teacher->faculty->name ?? 'Not assigned',
            'department' => $teacher->department->name ?? 'Not assigned',
            'office' => 'Not specified',
            'experience' => 'Not specified',
            'rating' => 4.5,
            'totalStudents' => $totalStudents,
            'status' => 'teaching',
            'nextClass' => $nextClass,
            'upcomingOfficeHours' => 'Not scheduled',
        ];
    }
}
