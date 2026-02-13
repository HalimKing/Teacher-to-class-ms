<?php

namespace App\Http\Controllers;

use App\Models\TeacherAttendance;
use App\Models\Course;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class TeacherAttendanceReportController extends Controller
{
    public function index()
    {
        return Inertia::render('teacher/attendance-report');
    }

    /**
     * Get all report data
     */
    public function getReportData(Request $request)
    {
        try {
            $startDate = $request->get('startDate') ? Carbon::parse($request->get('startDate')) : Carbon::now()->subMonth();
            $endDate = $request->get('endDate') ? Carbon::parse($request->get('endDate')) : Carbon::now();
            $courseId = $request->get('courseId');

            $query = TeacherAttendance::where('teacher_attendances.teacher_id', auth()->id())
                ->whereBetween('teacher_attendances.date', [$startDate->toDateString(), $endDate->toDateString()])
                ->join('courses', 'teacher_attendances.course_id', '=', 'courses.id')
                ->select('teacher_attendances.*', 'courses.name as course_name', 'courses.course_code', 'courses.student_size')
                ->with(['course', 'classroom', 'timetable']);

            if ($courseId && $courseId !== 'all') {
                $query->where('course_id', $courseId);
            }

            $records = $query->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'summaryMetrics' => $this->calculateSummaryMetrics($records, $startDate, $endDate),
                    'attendanceRatePerClass' => $this->calculateAttendanceRatePerClass($records),
                    'classPerformanceSummary' => $this->calculateClassPerformanceSummary($records),
                    'heatmapData' => $this->generateHeatmapData($records),
                    'courses' => $this->getTeacherCourses(),
                    'dateRange' => "{$startDate->format('M d, Y')} - {$endDate->format('M d, Y')}",
                ],
            ]);
        } catch (\Exception $e) {
            \Log::error('Error fetching report data: ' . $e->getMessage() . ' ' . $e->getTraceAsString());
            return response()->json([
                'success' => false,
                'message' => 'Error fetching report data: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Calculate summary metrics
     */
    private function calculateSummaryMetrics($records, $startDate, $endDate)
    {
        $totalRecords = $records->count();

        if ($totalRecords === 0) {
            return [
                [
                    'title' => 'Monthly Avg Attendance',
                    'value' => '0%',
                    'change' => 'No data',
                    'changeType' => 'neutral',
                ],
                [
                    'title' => 'Highest Attendance Class',
                    'value' => 'N/A',
                    'subtitle' => '0%',
                    'change' => '',
                    'changeType' => 'neutral',
                    'badge' => '0%',
                    'badgeColor' => 'text-gray-600 bg-gray-50',
                ],
                [
                    'title' => 'Average Attendance',
                    'value' => '0',
                    'subtitle' => 'Sessions',
                    'change' => '',
                    'changeType' => 'neutral',
                ],
                [
                    'title' => 'Total Sessions Conducted',
                    'value' => '0',
                    'change' => '',
                    'changeType' => 'neutral',
                ],
            ];
        }

        // Group by course and calculate attendance rates
        $courseStats = $records->groupBy('course_id')->map(function ($group) {
            // Try to get course name from the joined data first, then from relationship
            $firstRecord = $group->first();
            $courseName = !empty($firstRecord->course_name)
                ? $firstRecord->course_name
                : (optional($firstRecord->course)->name ?? 'Unknown');

            $total = $group->count();
            $completed = $group->where('status', 'present')->count();
            $rate = $total > 0 ? round(($completed / $total) * 100, 1) : 0;

            return [
                'name' => $courseName,
                'rate' => $rate,
                'total' => $total,
                'completed' => $completed,
            ];
        })->values();

        $avgAttendance = $courseStats->avg('rate');
        $highestClass = $courseStats->sortByDesc('rate')->first();
        $previousMonth = Carbon::now()->subMonth();
        $previousRecords = TeacherAttendance::where('teacher_attendances.teacher_id', auth()->id())
            ->whereBetween('teacher_attendances.date', [$previousMonth->copy()->subMonth()->toDateString(), $previousMonth->toDateString()])
            ->count();

        $change = $previousRecords > 0 ? ((($totalRecords - $previousRecords) / $previousRecords) * 100) : 0;
        $changeType = $change >= 0 ? 'positive' : 'negative';

        return [
            [
                'title' => 'Monthly Avg Attendance',
                'value' => round($avgAttendance, 1) . '%',
                'change' => ($change >= 0 ? '+' : '') . round($change, 1) . '% vs last mo',
                'changeType' => $changeType,
            ],
            [
                'title' => 'Highest Attendance Class',
                'value' => $highestClass['name'] ?? 'N/A',
                'subtitle' => round($highestClass['rate'] ?? 0, 1) . '%',
                'change' => '',
                'changeType' => 'neutral',
                'badge' => round($highestClass['rate'] ?? 0, 1) . '%',
                'badgeColor' => 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400',
            ],
            [
                'title' => 'Total Sessions',
                'value' => $totalRecords,
                'subtitle' => 'Conducted',
                'change' => '',
                'changeType' => 'neutral',
            ],
            [
                'title' => 'Avg Class Size',
                'value' => round($records->avg(fn($r) => $r->student_size ?? 0)),
                'subtitle' => 'Students',
                'change' => '',
                'changeType' => 'neutral',
            ],
        ];
    }

    /**
     * Calculate attendance rate per class
     */
    private function calculateAttendanceRatePerClass($records)
    {
        return $records->groupBy('course_id')->map(function ($group) {
            $firstRecord = $group->first();
            $courseName = !empty($firstRecord->course_name)
                ? $firstRecord->course_name
                : (optional($firstRecord->course)->name ?? 'Unknown');

            $total = $group->count();
            $completed = $group->where('status', 'present')->count();
            $rate = $total > 0 ? round(($completed / $total) * 100, 1) : 0;

            return [
                'class' => $courseName,
                'rate' => $rate,
                'color' => $rate >= 95 ? 'bg-green-500' : ($rate >= 85 ? 'bg-blue-500' : 'bg-orange-500'),
            ];
        })->values()->take(5)->toArray();
    }

    /**
     * Calculate class performance summary
     */
    private function calculateClassPerformanceSummary($records)
    {
        return $records->groupBy('course_id')->map(function ($group) {
            $firstRecord = $group->first();
            $courseName = !empty($firstRecord->course_name)
                ? $firstRecord->course_name
                : (optional($firstRecord->course)->name ?? 'Unknown');

            $total = $group->count();
            $completed = $group->where('status', 'present')->count();
            $pending = $group->where('status', 'absent')->count();
            $rate = $total > 0 ? round(($completed / $total) * 100, 1) : 0;

            $reliability = $rate >= 95 ? 'Excellent' : ($rate >= 85 ? 'Good' : ($rate >= 75 ? 'Average' : 'Poor'));
            $reliabilityColor = $rate >= 95
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : ($rate >= 85
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : ($rate >= 75
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'));

            return [
                'class' => $courseName,
                'present' => $completed,
                'absent' => 0,
                'late' => $pending,
                'reliability' => $reliability,
                'reliabilityColor' => $reliabilityColor,
                'trend' => $rate >= 90 ? 'up' : ($rate >= 75 ? 'neutral' : 'down'),
                'attendanceRate' => $rate,
            ];
        })->values()->take(10)->toArray();
    }

    /**
     * Generate heatmap data
     */
    private function generateHeatmapData($records)
    {
        $days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
        $weeks = 5;
        // Start from the beginning of the week that was $weeks-1 weeks ago, to include current week
        $startDate = Carbon::now()->subWeeks($weeks - 1)->startOfWeek();

        $heatmapData = [];

        for ($week = 0; $week < $weeks; $week++) {
            $weekData = [];
            foreach ([0, 1, 2, 3, 4, 5, 6] as $dayIndex) {
                $currentDate = $startDate->copy()->addDays(($week * 7) + $dayIndex);
                $dayRecords = $records->filter(fn($r) => Carbon::parse($r->date)->toDateString() === $currentDate->toDateString());

                $completed = $dayRecords->where('status', 'present')->count();
                $total = $dayRecords->count();

                // Intensity from 0-4
                $intensity = $total === 0 ? 0 : min(4, (int)(($completed / $total) * 4));
                $isHoliday = $currentDate->isWeekend() && $dayRecords->count() === 0;

                $weekData[] = [
                    'day' => $days[$dayIndex],
                    'week' => $week,
                    'date' => $currentDate->format('M d'),
                    'intensity' => $intensity,
                    'isHoliday' => $isHoliday,
                    'count' => $total,
                ];
            }
            $heatmapData[] = $weekData;
        }

        return $heatmapData;
    }

    /**
     * Get teacher's courses
     */
    private function getTeacherCourses()
    {
        return TeacherAttendance::where('teacher_attendances.teacher_id', auth()->id())
            ->with('course')
            ->get()
            ->groupBy('course_id')
            ->map(function ($group) {
                $course = optional($group->first()->course);
                return [
                    'id' => $course->id,
                    'name' => $course->name,
                    'code' => $course->course_code ?? '',
                ];
            })
            ->values()
            ->toArray();
    }
}
