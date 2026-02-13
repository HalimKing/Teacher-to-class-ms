<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\TeacherAttendance;
use App\Models\Teacher;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class TeacherAttendanceAnalysisController extends Controller
{
    /**
     * Display teacher attendance analysis
     */
    public function index()
    {
        return Inertia::render('admin/teacher/attendance-analysis', [
            'faculties' => $this->getFaculties(),
            'initialFilters' => [
                'startDate' => Carbon::now()->subMonth()->toDateString(),
                'endDate' => Carbon::now()->toDateString(),
            ],
        ]);
    }

    /**
     * Get comprehensive teacher attendance analysis data
     */
    public function getAnalysisData(Request $request)
    {
        try {
            $startDate = $request->get('startDate') ? Carbon::parse($request->get('startDate')) : Carbon::now()->subMonth();
            $endDate = $request->get('endDate') ? Carbon::parse($request->get('endDate')) : Carbon::now();
            $teacherId = $request->get('teacherId');
            $facultyId = $request->get('facultyId');
            $departmentId = $request->get('departmentId');
            $programId = $request->get('programId');
            $levelId = $request->get('levelId');

            // Get teachers with their attendance records
            $query = TeacherAttendance::whereBetween('teacher_attendances.date', [$startDate->toDateString(), $endDate->toDateString()])
                ->join('courses', 'teacher_attendances.course_id', '=', 'courses.id')
                ->join('teachers', 'teacher_attendances.teacher_id', '=', 'teachers.id')
                ->join('faculties', 'teachers.faculty_id', '=', 'faculties.id')
                ->join('departments', 'teachers.department_id', '=', 'departments.id')
                ->join('programs', 'courses.program_id', '=', 'programs.id')
                ->select(
                    'teacher_attendances.*',
                    'courses.name as course_name',
                    'teachers.faculty_id',
                    'faculties.name as faculty_name',
                    'departments.name as department_name',
                    'programs.name as program_name',
                    DB::raw("teachers.first_name || ' ' || teachers.last_name as teacher_name")
                )
                ->with(['course', 'classroom', 'timetable']);

            if ($teacherId && $teacherId !== 'all') {
                $query->where('teacher_attendances.teacher_id', $teacherId);
            }

            if ($facultyId && $facultyId !== 'all') {
                $query->where('teachers.faculty_id', $facultyId);
            }

            if ($departmentId && $departmentId !== 'all') {
                $query->where('teachers.department_id', $departmentId);
            }

            if ($programId && $programId !== 'all') {
                $query->join('programs', 'courses.program_id', '=', 'programs.id')
                    ->where('programs.id', $programId);
            }

            if ($levelId && $levelId !== 'all') {
                $query->join('levels', 'courses.level_id', '=', 'levels.id')
                    ->where('levels.id', $levelId);
            }

            $records = $query->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'overallMetrics' => $this->calculateOverallMetrics($records, $startDate, $endDate),
                    'teacherPerformance' => $this->calculateTeacherPerformance($records),
                    'attendanceDistribution' => $this->getAttendanceDistribution($records),
                    'topPerformers' => $this->getTopPerformers($records),
                    'attendanceByStatus' => $this->getAttendanceByStatus($records),
                    'filters' => [
                        'faculties' => $this->getFaculties(),
                        'departments' => $facultyId && $facultyId !== 'all' ? $this->getDepartments($facultyId) : [],
                        'programs' => $departmentId && $departmentId !== 'all' ? $this->getPrograms($departmentId) : [],
                        'levels' => $this->getLevels(),
                        'teachers' => $this->getAllTeachers(),
                    ],
                    'dateRange' => "{$startDate->format('M d, Y')} - {$endDate->format('M d, Y')}",
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching teacher attendance analysis: ' . $e->getMessage() . ' ' . $e->getTraceAsString());
            return response()->json([
                'success' => false,
                'message' => 'Error fetching analysis data: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Calculate overall metrics across all teachers
     */
    private function calculateOverallMetrics($records, $startDate, $endDate)
    {
        $totalRecords = $records->count();
        $uniqueTeachers = $records->groupBy('teacher_id')->count();
        $presentCount = $records->where('status', 'present')->count();
        $absentCount = $records->where('status', 'absent')->count();

        $attendanceRate = $totalRecords > 0 ? round(($presentCount / $totalRecords) * 100, 1) : 0;

        // Compare with previous period
        $previousStart = $startDate->copy()->subMonths(1);
        $previousEnd = $previousStart->copy()->addDays($endDate->diffInDays($startDate));

        $previousRecords = TeacherAttendance::whereBetween('teacher_attendances.date', [$previousStart->toDateString(), $previousEnd->toDateString()])
            ->count();
        $previousPresent = TeacherAttendance::whereBetween('teacher_attendances.date', [$previousStart->toDateString(), $previousEnd->toDateString()])
            ->where('status', 'present')
            ->count();

        $previousRate = $previousRecords > 0 ? ($previousPresent / $previousRecords) * 100 : 0;
        $rateChange = $previousRate > 0 ? (($attendanceRate - $previousRate) / $previousRate) * 100 : 0;

        return [
            [
                'title' => 'Attendance Rate',
                'value' => $attendanceRate . '%',
                'change' => ($rateChange >= 0 ? '+' : '') . round($rateChange, 1) . '% vs last period',
                'changeType' => $rateChange >= 0 ? 'positive' : 'negative',
                'icon' => 'TrendingUp',
            ],
            [
                'title' => 'Total Sessions',
                'value' => $totalRecords,
                'subtitle' => 'Recorded',
                'change' => '',
                'changeType' => 'neutral',
                'icon' => 'Calendar',
            ],
            [
                'title' => 'Active Teachers',
                'value' => $uniqueTeachers,
                'subtitle' => 'Teaching',
                'change' => '',
                'changeType' => 'neutral',
                'icon' => 'Users',
            ],
            [
                'title' => 'Avg Attendance',
                'value' => round($records->groupBy('teacher_id')->map(fn($g) => ($g->where('status', 'present')->count() / $g->count()) * 100)->avg(), 1) . '%',
                'subtitle' => 'Per teacher',
                'change' => '',
                'changeType' => 'neutral',
                'icon' => 'BarChart3',
            ],
        ];
    }

    /**
     * Calculate performance metrics per teacher
     */
    private function calculateTeacherPerformance($records)
    {
        return $records->groupBy('teacher_name')->map(function ($group) {
            $teacherId = $group->first()->teacher_id;
            $total = $group->count();
            $present = $group->where('status', 'present')->count();
            $absent = $group->where('status', 'absent')->count();
            $late = $group->where('status', 'late')->count();
            $rate = $total > 0 ? round(($present / $total) * 100, 1) : 0;

            // Get unique courses the teacher taught
            $courses = $group->pluck('course_name')->unique()->implode(',');

            // Get faculty and department
            $faculty = $group->first()->faculty_name ?? 'N/A';
            $department = $group->first()->department_name ?? 'N/A';
            $program = $group->first()->program_name ?? 'N/A';

            $reliability = $rate >= 95 ? 'Excellent' : ($rate >= 85 ? 'Good' : ($rate >= 75 ? 'Average' : 'Poor'));
            $reliabilityColor = $rate >= 95
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : ($rate >= 85
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : ($rate >= 75
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'));

            return [
                'teacherId' => $teacherId,
                'teacherName' => $group->first()->teacher_name,
                'courses' => $courses,
                'faculty' => $faculty,
                'department' => $department,
                'program' => $program,
                'total' => $total,
                'present' => $present,
                'absent' => $absent,
                'late' => $late,
                'attendanceRate' => $rate,
                'reliability' => $reliability,
                'reliabilityColor' => $reliabilityColor,
                'trend' => $rate >= 90 ? 'up' : ($rate >= 75 ? 'neutral' : 'down'),
            ];
        })
            ->sortByDesc('attendanceRate')
            ->values()
            ->take(20)
            ->toArray();
    }

    /**
     * Get attendance distribution (Present vs Absent vs Other)
     */
    private function getAttendanceDistribution($records)
    {
        $statusCounts = $records->groupBy('status')->map(fn($g) => $g->count());

        $total = $records->count();

        return [
            [
                'name' => 'Present',
                'value' => $statusCounts->get('present', 0),
                'percentage' => $total > 0 ? round(($statusCounts->get('present', 0) / $total) * 100, 1) : 0,
                'color' => '#10b981',
                'label' => 'Present',
            ],
            [
                'name' => 'Absent',
                'value' => $statusCounts->get('absent', 0),
                'percentage' => $total > 0 ? round(($statusCounts->get('absent', 0) / $total) * 100, 1) : 0,
                'color' => '#ef4444',
                'label' => 'Absent',
            ],
            [
                'name' => 'Other',
                'value' => $total - ($statusCounts->get('present', 0) + $statusCounts->get('absent', 0)),
                'percentage' => $total > 0 ? round((($total - ($statusCounts->get('present', 0) + $statusCounts->get('absent', 0))) / $total) * 100, 1) : 0,
                'color' => '#f59e0b',
                'label' => 'Other',
            ],
        ];
    }

    /**
     * Get top performing teachers
     */
    private function getTopPerformers($records)
    {
        return $records->groupBy('teacher_name')->map(function ($group) {
            $total = $group->count();
            $present = $group->where('status', 'present')->count();
            $rate = $total > 0 ? round(($present / $total) * 100, 1) : 0;

            return [
                'name' => $group->first()->teacher_name,
                'attendanceRate' => $rate,
                'sessions' => $total,
            ];
        })
            ->sortByDesc('attendanceRate')
            ->values()
            ->take(5)
            ->toArray();
    }

    /**
     * Get attendance by status over time
     */
    private function getAttendanceByStatus($records)
    {
        // Group by date and status
        $dateGroups = $records->groupBy(fn($r) => Carbon::parse($r->date)->format('M d'))->map(function ($dayRecords) {
            $statusCounts = $dayRecords->groupBy('status')->map(fn($g) => $g->count());

            return [
                'date' => $dayRecords->first()->date,
                'present' => $statusCounts->get('present', 0),
                'absent' => $statusCounts->get('absent', 0),
                'other' => $dayRecords->count() - ($statusCounts->get('present', 0) + $statusCounts->get('absent', 0)),
            ];
        })
            ->sortBy('date')
            ->values()
            ->take(30)
            ->toArray();

        return $dateGroups;
    }

    /**
     * Get all teachers for filter dropdown
     */
    private function getAllTeachers()
    {
        return Teacher::get()
            ->map(fn($t) => [
                'id' => $t->id,
                'name' => $t->first_name . ' ' . $t->last_name,
                'email' => $t->email ?? '',
            ])
            ->sortBy('name')
            ->values()
            ->toArray();
    }

    /**
     * Get all faculties
     */
    private function getFaculties()
    {
        return \App\Models\Faculty::get()
            ->map(fn($f) => [
                'id' => $f->id,
                'name' => $f->name,
            ])
            ->sortBy('name')
            ->values()
            ->toArray();
    }

    /**
     * Get departments for a faculty
     */
    private function getDepartments($facultyId = null)
    {
        $query = \App\Models\Department::query();

        if ($facultyId && $facultyId !== 'all') {
            $query->where('faculty_id', $facultyId);
        }

        return $query->get()
            ->map(fn($d) => [
                'id' => $d->id,
                'name' => $d->name,
                'facultyId' => $d->faculty_id,
            ])
            ->sortBy('name')
            ->values()
            ->toArray();
    }

    /**
     * Get programs for a department
     */
    private function getPrograms($departmentId = null)
    {
        $query = \App\Models\Program::query();

        if ($departmentId && $departmentId !== 'all') {
            $query->where('department_id', $departmentId);
        }

        return $query->get()
            ->map(fn($p) => [
                'id' => $p->id,
                'name' => $p->name,
                'departmentId' => $p->department_id,
            ])
            ->sortBy('name')
            ->values()
            ->toArray();
    }

    /**
     * Get all levels
     */
    private function getLevels()
    {
        return \App\Models\Level::get()
            ->map(fn($l) => [
                'id' => $l->id,
                'name' => $l->name,
            ])
            ->sortBy('name')
            ->values()
            ->toArray();
    }
}
