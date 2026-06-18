<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\Teacher;
use App\Models\TeacherAttendance;
use App\Models\TimeTable;
use App\Support\AttendanceRecordSource;
use App\Services\RescheduledAttendanceService;
use App\Services\Concerns\BuildsAttendanceAnalytics;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class AdminTeacherAttendanceReportService
{
    use BuildsAttendanceAnalytics;

    private const STATUS_COLUMN = 'status';

    public function __construct(
        private AttendanceTimingService $timingService,
        private RescheduledAttendanceService $rescheduledAttendance,
    ) {}

    public function baseQuery(): Builder
    {
        return TeacherAttendance::query()
            ->whereHas('teacher', fn (Builder $query) => $query->where('staff_type', Teacher::STAFF_TYPE_LECTURER))
            ->with([
                'teacher.department',
                'teacher.faculty',
                'course',
                'classroom',
                'timetable',
                'academicYear',
                'rescheduledSession.classroom',
                'rescheduledSession.timetable.classRoom',
            ]);
    }

    public function applyFilters(Builder $query, Request $request): Builder
    {
        if ($request->filled('start_date')) {
            $query->whereDate('date', '>=', Carbon::parse($request->start_date)->toDateString());
        }

        if ($request->filled('end_date')) {
            $query->whereDate('date', '<=', Carbon::parse($request->end_date)->toDateString());
        }

        if ($request->filled('month')) {
            $query->whereMonth('date', (int) $request->month);
        }

        if ($request->filled('year')) {
            $query->whereYear('date', (int) $request->year);
        }

        if ($request->filled('teacher_id') && $request->teacher_id !== 'all') {
            $query->where('teacher_id', (int) $request->teacher_id);
        }

        if ($request->filled('department_id') && $request->department_id !== 'all') {
            $query->whereHas('teacher', fn (Builder $teacherQuery) => $teacherQuery->where('department_id', (int) $request->department_id));
        }

        if ($request->filled('faculty_id') && $request->faculty_id !== 'all') {
            $query->whereHas('teacher', fn (Builder $teacherQuery) => $teacherQuery->where('faculty_id', (int) $request->faculty_id));
        }

        if ($request->filled('course_id') && $request->course_id !== 'all') {
            $query->where('course_id', (int) $request->course_id);
        }

        if ($request->filled('classroom_id') && $request->classroom_id !== 'all') {
            $query->where('classroom_id', (int) $request->classroom_id);
        }

        if ($request->filled('program_id') && $request->program_id !== 'all') {
            $query->whereHas('course', fn (Builder $courseQuery) => $courseQuery->where('program_id', (int) $request->program_id));
        }

        if ($request->filled('level_id') && $request->level_id !== 'all') {
            $query->whereHas('course', fn (Builder $courseQuery) => $courseQuery->where('level_id', (int) $request->level_id));
        }

        if ($request->filled('academic_year_id') && $request->academic_year_id !== 'all') {
            $query->where('academic_year_id', (int) $request->academic_year_id);
        }

        if ($request->filled('attendance_status') && $request->attendance_status !== 'all') {
            $query->where(self::STATUS_COLUMN, $request->attendance_status);
        }

        if ($request->filled('attendance_source') && $request->attendance_source !== 'all') {
            if ($request->attendance_source === AttendanceRecordSource::SYSTEM) {
                $query->where(function (Builder $sourceQuery) {
                    $sourceQuery->where('auto_generated', true)
                        ->orWhere('attendance_source', AttendanceRecordSource::SYSTEM);
                });
            } elseif ($request->attendance_source === AttendanceRecordSource::MANUAL) {
                $query->where(function (Builder $sourceQuery) {
                    $sourceQuery->where('auto_generated', false)
                        ->where(function (Builder $manualQuery) {
                            $manualQuery->whereNull('attendance_source')
                                ->orWhere('attendance_source', AttendanceRecordSource::MANUAL);
                        });
                });
            }
        }

        if ($request->filled('session_type') && $request->session_type !== 'all') {
            if ($request->session_type === 'rescheduled') {
                $query->whereNotNull('rescheduled_session_id');
            } elseif ($request->session_type === 'normal') {
                $query->whereNull('rescheduled_session_id');
            }
        }

        if ($request->filled('face_verification_status') && $request->face_verification_status !== 'all') {
            if ($request->face_verification_status === 'verified') {
                $query->where('face_verified', true);
            } elseif ($request->face_verification_status === 'unverified') {
                $query->where(function (Builder $faceQuery) {
                    $faceQuery->where('face_verified', false)->orWhereNull('face_verified');
                });
            }
        }

        if ($request->filled('geolocation_status') && $request->geolocation_status !== 'all') {
            if ($request->geolocation_status === 'verified') {
                $query->where('check_in_within_range', true);
            } elseif ($request->geolocation_status === 'failed') {
                $query->where(function (Builder $geoQuery) {
                    $geoQuery->where('check_in_within_range', false)->orWhereNull('check_in_within_range');
                });
            }
        }

        if ($request->filled('arrival_category') && $request->arrival_category !== 'all') {
            $query->where('arrival_category', $request->arrival_category);
        }

        if ($request->filled('day_of_week') && $request->day_of_week !== 'all') {
            $dayName = (string) $request->day_of_week;
            $dayIndex = array_search($dayName, ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], true);

            if ($dayIndex !== false) {
                $driver = $query->getConnection()->getDriverName();

                if ($driver === 'sqlite') {
                    $query->whereRaw("CAST(strftime('%w', date) AS INTEGER) = ?", [$dayIndex]);
                } else {
                    $query->whereRaw('DAYNAME(date) = ?', [$dayName]);
                }
            }
        }

        if ($request->filled('check_in_from')) {
            $query->whereTime('check_in_time', '>=', $request->check_in_from);
        }

        if ($request->filled('check_in_to')) {
            $query->whereTime('check_in_time', '<=', $request->check_in_to);
        }

        if ($request->filled('check_out_from')) {
            $query->whereTime('check_out_time', '>=', $request->check_out_from);
        }

        if ($request->filled('check_out_to')) {
            $query->whereTime('check_out_time', '<=', $request->check_out_to);
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->search);
            $query->where(function (Builder $searchQuery) use ($search) {
                $searchQuery->whereHas('teacher', function (Builder $teacherQuery) use ($search) {
                    $teacherQuery->where(function (Builder $nameQuery) use ($search) {
                        $nameQuery->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhere('employee_id', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
                })->orWhereHas('course', fn (Builder $courseQuery) => $courseQuery->where('name', 'like', "%{$search}%"));
            });
        }

        return $query;
    }

    public function applySorting(Builder $query, Request $request): Builder
    {
        $sortBy = $request->get('sort_by', 'date');
        $sortDir = strtolower((string) $request->get('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';

        $allowedSorts = [
            'date' => 'date',
            'check_in_time' => 'check_in_time',
            'check_out_time' => 'check_out_time',
            'attendance_status' => self::STATUS_COLUMN,
            'face_match_score' => 'face_match_score',
            'created_at' => 'created_at',
        ];

        $column = $allowedSorts[$sortBy] ?? 'date';

        return $query->orderBy($column, $sortDir)->orderBy('id', 'desc');
    }

    public function paginateRecords(Request $request)
    {
        $perPage = min(max((int) $request->get('per_page', 15), 5), 100);
        $query = $this->applySorting($this->applyFilters($this->baseQuery(), $request), $request);

        return $query->paginate($perPage)->through(fn (TeacherAttendance $record) => $this->transformRecord($record));
    }

    public function getRecords(Request $request): Collection
    {
        return $this->getFilteredAttendanceRecords($request)
            ->map(fn (TeacherAttendance $record) => $this->transformRecord($record));
    }

    public function getFilteredAttendanceRecords(Request $request): Collection
    {
        return $this->applySorting($this->applyFilters($this->baseQuery(), $request), $request)->get();
    }

    public function getSummaryCards(Request $request): array
    {
        $today = now()->toDateString();
        $records = $this->applyFilters($this->baseQuery(), $request)->get();
        $todayRecords = (clone $this->baseQuery())->whereDate('date', $today)->get();
        $monthRecords = (clone $this->baseQuery())
            ->whereMonth('date', now()->month)
            ->whereYear('date', now()->year)
            ->get();

        $totalTeachers = Teacher::where('staff_type', Teacher::STAFF_TYPE_LECTURER)->count();
        $presentToday = $todayRecords->filter(fn ($record) => $this->isPresentRecord($record, self::STATUS_COLUMN))->count();
        $lateToday = $todayRecords->filter(fn ($record) => $this->isLateRecord($record, self::STATUS_COLUMN))->count();
        $expectedToday = $this->expectedTeachersTodayCount();
        $absentToday = $todayRecords->where(self::STATUS_COLUMN, 'absent')->count();
        $autoGeneratedToday = $todayRecords->where('auto_generated', true)->count();
        $attendanceRate = $records->count() > 0
            ? round(($records->filter(fn ($record) => $this->isPresentRecord($record, self::STATUS_COLUMN))->count() / $records->count()) * 100, 1)
            : 0;

        $faceVerified = $records->where('face_verified', true)->count();
        $geoVerified = $records->where('check_in_within_range', true)->count();
        $faceSuccessRate = $records->count() > 0 ? round(($faceVerified / $records->count()) * 100, 1) : 0;
        $geoSuccessRate = $records->count() > 0 ? round(($geoVerified / $records->count()) * 100, 1) : 0;
        $avgWorkingHours = $this->averageWorkingHours($records) ?? '00:00';
        $monthlyCheckIns = $monthRecords->filter(fn ($record) => !empty($record->check_in_time))->count();

        $previousStart = $request->filled('start_date')
            ? Carbon::parse($request->start_date)->subMonth()
            : now()->subMonth()->startOfMonth();
        $previousEnd = $request->filled('end_date')
            ? Carbon::parse($request->end_date)->subMonth()
            : now()->subMonth()->endOfMonth();

        $previousRecords = $this->applyFilters($this->baseQuery(), new Request([
            'start_date' => $previousStart->toDateString(),
            'end_date' => $previousEnd->toDateString(),
        ]))->get();

        $previousRate = $previousRecords->count() > 0
            ? ($previousRecords->filter(fn ($record) => $this->isPresentRecord($record, self::STATUS_COLUMN))->count() / $previousRecords->count()) * 100
            : 0;
        $rateChange = $previousRate > 0 ? round((($attendanceRate - $previousRate) / $previousRate) * 100, 1) : 0;

        return [
            ['title' => 'Total Teachers', 'value' => (string) $totalTeachers, 'change' => '', 'changeType' => 'neutral', 'icon' => 'Users'],
            ['title' => 'Total Attendance Records', 'value' => (string) $records->count(), 'change' => 'Filtered range', 'changeType' => 'neutral', 'icon' => 'Calendar'],
            ['title' => 'Present Today', 'value' => (string) $presentToday, 'change' => $expectedToday > 0 ? round(($presentToday / $expectedToday) * 100, 1) . '% of scheduled' : 'No schedules', 'changeType' => 'positive', 'icon' => 'CheckCircle'],
            ['title' => 'Absent Today', 'value' => (string) $absentToday, 'change' => $expectedToday > 0 ? round(($absentToday / $expectedToday) * 100, 1) . '% of scheduled' : 'No schedules', 'changeType' => $absentToday > 0 ? 'negative' : 'neutral', 'icon' => 'XCircle'],
            ['title' => 'Auto Generated Absences', 'value' => (string) $autoGeneratedToday, 'change' => 'System recorded today', 'changeType' => $autoGeneratedToday > 0 ? 'negative' : 'neutral', 'icon' => 'AlertTriangle'],
            ['title' => 'Late Arrivals', 'value' => (string) $lateToday, 'change' => $presentToday > 0 ? round(($lateToday / max($presentToday, 1)) * 100, 1) . '% of present' : '', 'changeType' => $lateToday > 0 ? 'negative' : 'neutral', 'icon' => 'Clock'],
            ['title' => 'Attendance Rate', 'value' => $attendanceRate . '%', 'change' => ($rateChange >= 0 ? '+' : '') . $rateChange . '% vs previous period', 'changeType' => $rateChange >= 0 ? 'positive' : 'negative', 'icon' => 'TrendingUp'],
            ['title' => 'Face Verification Success Rate', 'value' => $faceSuccessRate . '%', 'change' => $faceVerified . ' verified records', 'changeType' => 'positive', 'icon' => 'ShieldCheck'],
            ['title' => 'Geolocation Verification Success Rate', 'value' => $geoSuccessRate . '%', 'change' => $geoVerified . ' verified records', 'changeType' => 'positive', 'icon' => 'MapPin'],
            ['title' => 'Average Working Hours', 'value' => $avgWorkingHours, 'change' => 'Per completed session', 'changeType' => 'neutral', 'icon' => 'Clock'],
            ['title' => 'Total Check-ins This Month', 'value' => (string) $monthlyCheckIns, 'change' => now()->format('F Y'), 'changeType' => 'neutral', 'icon' => 'Calendar'],
        ];
    }

    public function getAnalytics(Request $request): array
    {
        $records = $this->applyFilters($this->baseQuery(), $request)->get();
        [$start, $end] = $this->resolveReportDateRange(
            $request->input('start_date'),
            $request->input('end_date'),
        );

        return [
            'dailyTrend' => $this->groupTrend($records, 'day', self::STATUS_COLUMN, $start, $end),
            'weeklyTrend' => $this->groupTrend($records, 'week', self::STATUS_COLUMN, $start, $end),
            'monthlyTrend' => $this->groupTrend($records, 'month', self::STATUS_COLUMN, $start, $end),
            'verificationAnalytics' => $this->verificationAnalytics($records),
            'verificationTrend' => $this->verificationTrendOverTime($records, self::STATUS_COLUMN, $start, $end),
            'performanceAnalytics' => $this->performanceAnalytics(
                $records,
                'teacher_id',
                self::STATUS_COLUMN,
                fn (TeacherAttendance $record) => [
                    'id' => $record->teacher?->id,
                    'name' => trim(($record->teacher?->first_name ?? '') . ' ' . ($record->teacher?->last_name ?? '')),
                    'department' => $record->teacher?->department?->name ?? 'N/A',
                ]
            ),
        ];
    }

    public function getIndividualReport(Teacher $teacher, Request $request): array
    {
        $request->merge(['teacher_id' => $teacher->id]);
        $records = $this->applyFilters($this->baseQuery(), $request)->get();
        [$start, $end] = $this->resolveReportDateRange(
            $request->input('start_date'),
            $request->input('end_date'),
        );
        $checkIns = $records->filter(fn (TeacherAttendance $record) => !empty($record->check_in_time));
        $checkOuts = $records->filter(fn (TeacherAttendance $record) => !empty($record->check_out_time));

        return [
            'teacher' => [
                'id' => $teacher->id,
                'name' => trim("{$teacher->title} {$teacher->first_name} {$teacher->last_name}"),
                'email' => $teacher->email,
                'employee_id' => $teacher->employee_id,
                'department' => $teacher->department?->name,
                'faculty' => $teacher->faculty?->name,
                'face_enrollment_status' => $teacher->faceEnrollmentStatus(),
            ],
            'summary' => [
                'total_records' => $records->count(),
                'present_count' => $records->filter(fn ($record) => $this->isPresentRecord($record, self::STATUS_COLUMN))->count(),
                'late_count' => $records->filter(fn ($record) => $this->isLateRecord($record, self::STATUS_COLUMN))->count(),
                'completed_count' => $records->where(self::STATUS_COLUMN, 'completed')->count(),
                'attendance_rate' => $records->count() > 0
                    ? round(($records->filter(fn ($record) => $this->isPresentRecord($record, self::STATUS_COLUMN))->count() / $records->count()) * 100, 1)
                    : 0,
                'average_check_in_time' => $this->averageTime($checkIns->pluck('check_in_time')->filter()->all()),
                'average_check_out_time' => $this->averageTime($checkOuts->pluck('check_out_time')->filter()->all()),
                'face_verified_count' => $records->where('face_verified', true)->count(),
                'geolocation_verified_count' => $records->where('check_in_within_range', true)->count(),
                'average_working_hours' => $this->averageWorkingHours($records),
            ],
            'monthlyStatistics' => $records->groupBy(fn (TeacherAttendance $record) => Carbon::parse($record->date)->format('Y-m'))
                ->map(function (Collection $monthRecords, string $month) {
                    $present = $monthRecords->filter(fn ($record) => $this->isPresentRecord($record, self::STATUS_COLUMN))->count();

                    return [
                        'month' => Carbon::createFromFormat('Y-m', $month)->format('M Y'),
                        'total' => $monthRecords->count(),
                        'present' => $present,
                        'late' => $monthRecords->filter(fn ($record) => $this->isLateRecord($record, self::STATUS_COLUMN))->count(),
                        'attendance_rate' => $monthRecords->count() > 0 ? round(($present / $monthRecords->count()) * 100, 1) : 0,
                    ];
                })
                ->values()
                ->sortByDesc('month')
                ->values()
                ->all(),
            'attendanceTrend' => $this->groupTrend($records, 'day', self::STATUS_COLUMN, $start, $end),
            'attendanceCalendar' => $this->attendanceCalendar($records, self::STATUS_COLUMN),
            'records' => $records->map(fn (TeacherAttendance $record) => $this->transformRecord($record))->values()->all(),
        ];
    }

    public function getFilterOptions(): array
    {
        return [
            'teachers' => Teacher::where('staff_type', Teacher::STAFF_TYPE_LECTURER)
                ->orderBy('first_name')
                ->get(['id', 'first_name', 'last_name', 'employee_id'])
                ->map(fn (Teacher $teacher) => [
                    'id' => $teacher->id,
                    'name' => trim("{$teacher->first_name} {$teacher->last_name}"),
                    'employee_id' => $teacher->employee_id,
                ])
                ->values()
                ->all(),
            'faculties' => Faculty::orderBy('name')->get(['id', 'name'])->values()->all(),
            'departments' => Department::orderBy('name')->get(['id', 'name', 'faculty_id'])->values()->all(),
            'courses' => Course::orderBy('name')->get(['id', 'name', 'program_id'])->values()->all(),
            'attendanceStatuses' => ['pending', 'present', 'absent', 'completed', 'incomplete', 'late', 'checked_in', 'early_leave', 'overtime'],
            'attendanceSources' => [
                ['value' => AttendanceRecordSource::MANUAL, 'label' => 'Manual Attendance'],
                ['value' => AttendanceRecordSource::SYSTEM, 'label' => 'System Generated'],
            ],
            'sessionTypes' => [
                ['value' => 'normal', 'label' => 'Normal Sessions'],
                ['value' => 'rescheduled', 'label' => 'Rescheduled Sessions'],
            ],
        ];
    }

    public function exportRows(Collection $records): array
    {
        return $records->map(function (array $record) {
            return [
                'Teacher Name' => $record['teacher_name'],
                'Staff ID' => $record['staff_id'],
                'Department' => $record['department'],
                'Course/Class' => $record['course_class'],
                'Date' => $record['date'],
                'Check-in Time' => $record['check_in_time'],
                'Check-out Time' => $record['check_out_time'],
                'Total Working Hours' => $record['working_hours'],
                'Attendance Status' => $record['attendance_status'],
                'Arrival Category' => $record['arrival_category_label'] ?? '—',
                'Minutes Early' => $record['minutes_early'] ?? '—',
                'Minutes Late' => $record['minutes_late'] ?? '—',
                'Departure Category' => $record['departure_category_label'] ?? '—',
                'Minutes Overtime' => $record['minutes_overtime'] ?? '—',
                'Geolocation Verification Status' => $record['geolocation_status'],
                'Face Verification Status' => $record['face_verification_status'],
                'Face Match Score' => $record['face_match_score'],
                'Attendance Source' => $record['attendance_source'],
                'Session Type' => $record['reschedule_status'],
                'Original Schedule' => $record['reschedule']
                    ? ($record['reschedule']['original_date_display'] . ', ' . $record['reschedule']['original_start_time_display'] . ' – ' . $record['reschedule']['original_end_time_display'] . ', ' . ($record['reschedule']['original_venue'] ?? '—'))
                    : '—',
                'Rescheduled Schedule' => $record['reschedule']
                    ? ($record['reschedule']['new_date_display'] . ', ' . $record['reschedule']['new_start_time_display'] . ' – ' . $record['reschedule']['new_end_time_display'] . ', ' . ($record['reschedule']['new_venue'] ?? '—'))
                    : '—',
                'Created Date' => $record['created_at'],
            ];
        })->all();
    }

    public function transformAttendanceRecord(TeacherAttendance $record): array
    {
        return $this->transformRecord($record);
    }

    private function transformRecord(TeacherAttendance $record): array
    {
        $teacher = $record->teacher;
        $courseName = $record->course?->name ?? 'N/A';
        $className = $record->classroom?->name;
        $arrival = $this->timingService->resolveArrivalForRecord(
            $record->arrival_category,
            $record->minutes_early,
            $record->minutes_late,
            $record->check_in_time,
            $record->timetable?->start_time,
            $record->date ? Carbon::parse($record->date) : null,
            AttendanceTimingService::ROLE_TEACHER
        );
        $departure = $this->timingService->resolveDepartureForRecord(
            $record->departure_category,
            $record->minutes_overtime,
            $record->check_out_time,
            $record->timetable?->end_time,
            $record->date ? Carbon::parse($record->date) : null,
            $record->status,
            AttendanceTimingService::ROLE_TEACHER
        );

        return [
            'id' => $record->id,
            'staff_id' => $teacher?->employee_id,
            'teacher_member_id' => $record->teacher_id,
            'teacher_name' => trim(($teacher?->first_name ?? '') . ' ' . ($teacher?->last_name ?? '')),
            'department' => $teacher?->department?->name ?? 'N/A',
            'faculty' => $teacher?->faculty?->name ?? 'N/A',
            'course_class' => $className ? "{$courseName} / {$className}" : $courseName,
            'course' => $courseName,
            'classroom' => $className,
            'date' => $record->date?->format('Y-m-d'),
            'check_in_time' => $this->formatTime($record->check_in_time),
            'check_out_time' => $this->formatTime($record->check_out_time),
            'working_hours' => $this->calculateWorkingHours($record->check_in_time, $record->check_out_time),
            'attendance_status' => $record->status,
            'arrival_category' => $arrival['arrival_category'],
            'arrival_category_label' => $arrival['arrival_category_label'],
            'minutes_early' => $arrival['minutes_early'],
            'minutes_late' => $arrival['minutes_late'],
            'departure_category' => $departure['departure_category'],
            'departure_category_label' => $departure['departure_category_label'],
            'minutes_overtime' => $departure['minutes_overtime'],
            'is_overtime' => $departure['is_overtime'],
            'geolocation_status' => $record->check_in_within_range ? 'Verified' : 'Failed',
            'face_verification_status' => $record->face_verified ? 'Verified' : 'Unverified',
            'face_match_score' => $record->face_match_score,
            'attendance_source' => $this->resolveAttendanceSource($record),
            'auto_generated' => (bool) $record->auto_generated,
            'auto_absence_reason' => $record->auto_absence_reason,
            'is_rescheduled' => $record->rescheduled_session_id !== null,
            'reschedule_status' => $record->rescheduled_session_id ? 'Rescheduled' : 'Normal',
            'reschedule' => $this->rescheduledAttendance->formatRecordReschedule($record),
            'created_at' => $record->created_at?->format('Y-m-d H:i:s'),
        ];
    }

    private function resolveAttendanceSource(TeacherAttendance $record): string
    {
        if ($record->auto_generated || $record->attendance_source === AttendanceRecordSource::SYSTEM) {
            return AttendanceRecordSource::label(AttendanceRecordSource::SYSTEM, true);
        }

        if ($record->check_in_time) {
            return AttendanceRecordSource::portalLabel(
                (bool) $record->face_verified,
                (bool) $record->check_in_within_range,
            );
        }

        return AttendanceRecordSource::label(AttendanceRecordSource::MANUAL);
    }

    private function expectedTeachersTodayCount(): int
    {
        return TimeTable::where('staff_type', Teacher::STAFF_TYPE_LECTURER)
            ->where('day_of_week', now()->format('l'))
            ->distinct('teacher_id')
            ->count('teacher_id');
    }
}
