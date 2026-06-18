<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\StaffAttendance;
use App\Models\Teacher;
use App\Models\TimeTable;
use App\Support\AttendanceRecordSource;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class AdminStaffAttendanceReportService
{
    public function __construct(
        private AttendanceTimingService $timingService
    ) {}

    public function baseQuery(): Builder
    {
        return StaffAttendance::query()
            ->whereHas('staff', fn (Builder $query) => $query->where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR))
            ->with([
                'staff.department',
                'staff.faculty',
                'timetable',
                'classroom',
                'academicYear',
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

        if ($request->filled('staff_id') && $request->staff_id !== 'all') {
            $query->where('staff_id', (int) $request->staff_id);
        }

        if ($request->filled('department_id') && $request->department_id !== 'all') {
            $query->whereHas('staff', fn (Builder $staffQuery) => $staffQuery->where('department_id', (int) $request->department_id));
        }

        if ($request->filled('faculty_id') && $request->faculty_id !== 'all') {
            $query->whereHas('staff', fn (Builder $staffQuery) => $staffQuery->where('faculty_id', (int) $request->faculty_id));
        }

        if ($request->filled('attendance_status') && $request->attendance_status !== 'all') {
            $query->where('attendance_status', $request->attendance_status);
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

        if ($request->filled('arrival_category') && $request->arrival_category !== 'all') {
            $query->where('arrival_category', $request->arrival_category);
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

        if ($request->filled('check_in_from')) {
            $query->whereTime('check_in_time', '>=', $request->check_in_from);
        }

        if ($request->filled('check_in_to')) {
            $query->whereTime('check_in_time', '<=', $request->check_in_to);
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->search);
            $query->whereHas('staff', function (Builder $staffQuery) use ($search) {
                $staffQuery->where(function (Builder $nameQuery) use ($search) {
                    $nameQuery->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('employee_id', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
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
            'attendance_status' => 'attendance_status',
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

        return $query->paginate($perPage)->through(fn (StaffAttendance $record) => $this->transformRecord($record));
    }

    public function getRecords(Request $request): Collection
    {
        return $this->applySorting($this->applyFilters($this->baseQuery(), $request), $request)
            ->get()
            ->map(fn (StaffAttendance $record) => $this->transformRecord($record));
    }

    public function getSummaryCards(Request $request): array
    {
        $today = now()->toDateString();
        $filteredQuery = $this->applyFilters($this->baseQuery(), $request);
        $records = (clone $filteredQuery)->get();

        $todayRecords = (clone $this->baseQuery())->whereDate('date', $today)->get();
        $totalAdministrators = Teacher::where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR)->count();
        $presentToday = $todayRecords->whereIn('attendance_status', ['checked_in', 'completed', 'late'])->count();
        $lateToday = $todayRecords->where('attendance_status', 'late')->count();
        $earlyToday = $todayRecords->where('arrival_category', 'early')->count();
        $earlyRecords = $records->where('arrival_category', 'early');
        $earlyCount = $earlyRecords->count();
        $presentCount = $records->whereIn('attendance_status', ['checked_in', 'completed', 'late'])->count();
        $averageMinutesEarly = $earlyRecords->count() > 0
            ? round($earlyRecords->avg('minutes_early'), 1)
            : 0;
        $earlyArrivalPercentage = $presentCount > 0
            ? round(($earlyCount / $presentCount) * 100, 1)
            : 0;
        $verifiedCount = $records->where('face_verified', true)->count();
        $unverifiedCount = $records->filter(fn (StaffAttendance $record) => !$record->face_verified)->count();
        $expectedToday = $this->expectedAdministratorsTodayCount();
        $absentToday = $todayRecords->where('attendance_status', 'absent')->count();
        $autoGeneratedToday = $todayRecords->where('auto_generated', true)->count();
        $attendanceRate = $records->count() > 0
            ? round(($records->whereIn('attendance_status', ['checked_in', 'completed', 'late'])->count() / $records->count()) * 100, 1)
            : 0;

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
            ? ($previousRecords->whereIn('attendance_status', ['checked_in', 'completed', 'late'])->count() / $previousRecords->count()) * 100
            : 0;
        $rateChange = $previousRate > 0 ? round((($attendanceRate - $previousRate) / $previousRate) * 100, 1) : 0;

        return [
            [
                'title' => 'Total Administrators',
                'value' => (string) $totalAdministrators,
                'change' => '',
                'changeType' => 'neutral',
                'icon' => 'Users',
            ],
            [
                'title' => 'Total Attendance Records',
                'value' => (string) $records->count(),
                'change' => 'Filtered range',
                'changeType' => 'neutral',
                'icon' => 'Calendar',
            ],
            [
                'title' => 'Present Today',
                'value' => (string) $presentToday,
                'change' => $expectedToday > 0 ? round(($presentToday / $expectedToday) * 100, 1) . '% of scheduled' : 'No schedules',
                'changeType' => 'positive',
                'icon' => 'CheckCircle',
            ],
            [
                'title' => 'Absent Today',
                'value' => (string) $absentToday,
                'change' => $expectedToday > 0 ? round(($absentToday / $expectedToday) * 100, 1) . '% of scheduled' : 'No schedules',
                'changeType' => $absentToday > 0 ? 'negative' : 'neutral',
                'icon' => 'XCircle',
            ],
            [
                'title' => 'Auto Generated Absences',
                'value' => (string) $autoGeneratedToday,
                'change' => 'System recorded today',
                'changeType' => $autoGeneratedToday > 0 ? 'negative' : 'neutral',
                'icon' => 'AlertTriangle',
            ],
            [
                'title' => 'Late Check-ins',
                'value' => (string) $lateToday,
                'change' => $presentToday > 0 ? round(($lateToday / max($presentToday, 1)) * 100, 1) . '% of present' : '',
                'changeType' => $lateToday > 0 ? 'negative' : 'neutral',
                'icon' => 'Clock',
            ],
            [
                'title' => 'Early Check-ins',
                'value' => (string) $earlyCount,
                'change' => $presentCount > 0 ? $earlyArrivalPercentage . '% of present' : '',
                'changeType' => $earlyCount > 0 ? 'positive' : 'neutral',
                'icon' => 'CheckCircle',
            ],
            [
                'title' => 'Avg Minutes Early',
                'value' => $earlyCount > 0 ? (string) $averageMinutesEarly : '0',
                'change' => $earlyToday > 0 ? $earlyToday . ' early today' : 'No early check-ins today',
                'changeType' => $earlyCount > 0 ? 'positive' : 'neutral',
                'icon' => 'TrendingUp',
            ],
            [
                'title' => 'Early Arrival Rate',
                'value' => $earlyArrivalPercentage . '%',
                'change' => $earlyCount . ' early check-ins in range',
                'changeType' => $earlyArrivalPercentage >= 20 ? 'positive' : 'neutral',
                'icon' => 'TrendingUp',
            ],
            [
                'title' => 'Attendance Rate',
                'value' => $attendanceRate . '%',
                'change' => ($rateChange >= 0 ? '+' : '') . $rateChange . '% vs previous period',
                'changeType' => $rateChange >= 0 ? 'positive' : 'negative',
                'icon' => 'TrendingUp',
            ],
            [
                'title' => 'Verified Face Attendance',
                'value' => (string) $verifiedCount,
                'change' => $records->count() > 0 ? round(($verifiedCount / $records->count()) * 100, 1) . '% verified' : '',
                'changeType' => 'positive',
                'icon' => 'ShieldCheck',
            ],
            [
                'title' => 'Unverified Attendance',
                'value' => (string) $unverifiedCount,
                'change' => $records->count() > 0 ? round(($unverifiedCount / $records->count()) * 100, 1) . '% unverified' : '',
                'changeType' => $unverifiedCount > 0 ? 'negative' : 'neutral',
                'icon' => 'ShieldX',
            ],
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
            'dailyTrend' => $this->groupTrend($records, 'day', $start, $end),
            'weeklyTrend' => $this->groupTrend($records, 'week', $start, $end),
            'monthlyTrend' => $this->groupTrend($records, 'month', $start, $end),
            'verificationAnalytics' => $this->verificationAnalytics($records),
            'performanceAnalytics' => $this->performanceAnalytics($records),
        ];
    }

    private function resolveReportDateRange(?string $startDate, ?string $endDate): array
    {
        $end = $endDate ? Carbon::parse($endDate)->startOfDay() : Carbon::today();
        $start = $startDate ? Carbon::parse($startDate)->startOfDay() : $end->copy()->subMonth();

        if ($start->gt($end)) {
            [$start, $end] = [$end->copy(), $start->copy()];
        }

        return [$start, $end];
    }

    public function getIndividualReport(Teacher $teacher, Request $request): array
    {
        $request->merge(['staff_id' => $teacher->id]);
        $records = $this->applyFilters($this->baseQuery(), $request)->get();

        $checkIns = $records->filter(fn (StaffAttendance $record) => !empty($record->check_in_time));
        $checkOuts = $records->filter(fn (StaffAttendance $record) => !empty($record->check_out_time));

        return [
            'staff' => [
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
                'present_count' => $records->whereIn('attendance_status', ['checked_in', 'completed', 'late'])->count(),
                'late_count' => $records->where('attendance_status', 'late')->count(),
                'early_count' => $records->where('arrival_category', 'early')->count(),
                'on_time_count' => $records->where('arrival_category', 'on_time')->count(),
                'average_minutes_early' => $records->where('arrival_category', 'early')->count() > 0
                    ? round($records->where('arrival_category', 'early')->avg('minutes_early'), 1)
                    : 0,
                'early_arrival_percentage' => $records->whereIn('attendance_status', ['checked_in', 'completed', 'late'])->count() > 0
                    ? round(($records->where('arrival_category', 'early')->count() / $records->whereIn('attendance_status', ['checked_in', 'completed', 'late'])->count()) * 100, 1)
                    : 0,
                'completed_count' => $records->where('attendance_status', 'completed')->count(),
                'attendance_rate' => $records->count() > 0
                    ? round(($records->whereIn('attendance_status', ['checked_in', 'completed', 'late'])->count() / $records->count()) * 100, 1)
                    : 0,
                'average_check_in_time' => $this->averageTime($checkIns->pluck('check_in_time')->filter()->all()),
                'average_check_out_time' => $this->averageTime($checkOuts->pluck('check_out_time')->filter()->all()),
                'face_verified_count' => $records->where('face_verified', true)->count(),
                'geolocation_verified_count' => $records->where('check_in_within_range', true)->count(),
            ],
            'monthlyStatistics' => $records->groupBy(fn (StaffAttendance $record) => Carbon::parse($record->date)->format('Y-m'))
                ->map(function (Collection $monthRecords, string $month) {
                    return [
                        'month' => Carbon::createFromFormat('Y-m', $month)->format('M Y'),
                        'total' => $monthRecords->count(),
                        'present' => $monthRecords->whereIn('attendance_status', ['checked_in', 'completed', 'late'])->count(),
                        'late' => $monthRecords->where('attendance_status', 'late')->count(),
                        'early' => $monthRecords->where('arrival_category', 'early')->count(),
                        'attendance_rate' => $monthRecords->count() > 0
                            ? round(($monthRecords->whereIn('attendance_status', ['checked_in', 'completed', 'late'])->count() / $monthRecords->count()) * 100, 1)
                            : 0,
                    ];
                })
                ->values()
                ->sortByDesc('month')
                ->values()
                ->all(),
            'records' => $records->map(fn (StaffAttendance $record) => $this->transformRecord($record))->values()->all(),
        ];
    }

    public function getFilterOptions(): array
    {
        return [
            'administrators' => Teacher::where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR)
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
            'attendanceStatuses' => ['pending', 'checked_in', 'completed', 'late', 'early_leave', 'overtime', 'incomplete', 'absent'],
            'attendanceSources' => [
                ['value' => AttendanceRecordSource::MANUAL, 'label' => 'Manual Attendance'],
                ['value' => AttendanceRecordSource::SYSTEM, 'label' => 'System Generated'],
            ],
            'arrivalCategories' => [
                ['value' => 'early', 'label' => 'Early'],
                ['value' => 'on_time', 'label' => 'On Time'],
                ['value' => 'late', 'label' => 'Late'],
            ],
        ];
    }

    public function exportRows(Collection $records): array
    {
        return $records->map(function (array $record) {
            return [
                'Administrator Name' => $record['administrator_name'],
                'Staff ID' => $record['staff_id'],
                'Department' => $record['department'],
                'Date' => $record['date'],
                'Check-in Time' => $record['check_in_time'],
                'Check-out Time' => $record['check_out_time'],
                'Working Hours' => $record['working_hours'],
                'Attendance Status' => $record['attendance_status'],
                'Arrival Category' => $record['arrival_category_label'],
                'Minutes Early' => $record['minutes_early'] ?? '—',
                'Minutes Late' => $record['minutes_late'] ?? '—',
                'Early Check-in' => $record['early_check_in'] ? 'Yes' : 'No',
                'Departure Category' => $record['departure_category_label'] ?? '—',
                'Minutes Overtime' => $record['minutes_overtime'] ?? '—',
                'Geolocation Status' => $record['geolocation_status'],
                'Face Verification Status' => $record['face_verification_status'],
                'Face Match Score' => $record['face_match_score'],
                'Attendance Source' => $record['attendance_source'],
                'Created Date' => $record['created_at'],
            ];
        })->all();
    }

    private function transformRecord(StaffAttendance $record): array
    {
        $staff = $record->staff;
        $arrival = $this->timingService->resolveArrivalForRecord(
            $record->arrival_category,
            $record->minutes_early,
            $record->minutes_late,
            $record->check_in_time,
            $record->timetable?->start_time,
            $record->date ? Carbon::parse($record->date) : null,
            AttendanceTimingService::ROLE_ADMINISTRATOR
        );
        $departure = $this->timingService->resolveDepartureForRecord(
            $record->departure_category,
            $record->minutes_overtime,
            $record->check_out_time,
            $record->timetable?->end_time,
            $record->date ? Carbon::parse($record->date) : null,
            $record->attendance_status,
            AttendanceTimingService::ROLE_ADMINISTRATOR
        );

        return [
            'id' => $record->id,
            'staff_id' => $staff?->employee_id,
            'staff_member_id' => $record->staff_id,
            'administrator_name' => trim(($staff?->first_name ?? '') . ' ' . ($staff?->last_name ?? '')),
            'department' => $staff?->department?->name ?? 'N/A',
            'faculty' => $staff?->faculty?->name ?? 'N/A',
            'date' => $record->date?->format('Y-m-d'),
            'check_in_time' => $this->formatTime($record->check_in_time),
            'check_out_time' => $this->formatTime($record->check_out_time),
            'working_hours' => $this->calculateWorkingHours($record->check_in_time, $record->check_out_time),
            'attendance_status' => $record->attendance_status,
            'arrival_category' => $arrival['arrival_category'],
            'arrival_category_label' => $arrival['arrival_category_label'],
            'minutes_early' => $arrival['minutes_early'],
            'minutes_late' => $arrival['minutes_late'],
            'early_check_in' => $arrival['early_check_in'],
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
            'created_at' => $record->created_at?->format('Y-m-d H:i:s'),
            'classroom' => $record->classroom?->name,
        ];
    }

    private function resolveAttendanceSource(StaffAttendance $record): string
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

    private function calculateWorkingHours(?string $checkIn, ?string $checkOut): ?string
    {
        if (!$checkIn || !$checkOut) {
            return null;
        }

        try {
            $start = Carbon::createFromFormat('H:i:s', strlen($checkIn) === 5 ? "{$checkIn}:00" : $checkIn);
            $end = Carbon::createFromFormat('H:i:s', strlen($checkOut) === 5 ? "{$checkOut}:00" : $checkOut);
            $minutes = $start->diffInMinutes($end);

            return sprintf('%02d:%02d', intdiv($minutes, 60), $minutes % 60);
        } catch (\Throwable) {
            return null;
        }
    }

    private function formatTime(?string $time): ?string
    {
        if (!$time) {
            return null;
        }

        try {
            return Carbon::createFromFormat('H:i:s', strlen($time) === 5 ? "{$time}:00" : $time)->format('h:i A');
        } catch (\Throwable) {
            return $time;
        }
    }

    private function averageTime(array $times): ?string
    {
        if (empty($times)) {
            return null;
        }

        $totalMinutes = 0;
        $count = 0;

        foreach ($times as $time) {
            try {
                $parsed = Carbon::createFromFormat('H:i:s', strlen($time) === 5 ? "{$time}:00" : $time);
                $totalMinutes += ($parsed->hour * 60) + $parsed->minute;
                $count++;
            } catch (\Throwable) {
                continue;
            }
        }

        if ($count === 0) {
            return null;
        }

        $average = intdiv($totalMinutes, $count);

        return Carbon::createFromTime(intdiv($average, 60), $average % 60)->format('h:i A');
    }

    private function expectedAdministratorsTodayCount(): int
    {
        $today = now()->format('l');

        return TimeTable::where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR)
            ->where('day_of_week', now()->format('l'))
            ->distinct('teacher_id')
            ->count('teacher_id');
    }

    private function groupTrend(Collection $records, string $period, Carbon $start, Carbon $end): array
    {
        $grouped = $records->groupBy(function (StaffAttendance $record) use ($period) {
            $date = Carbon::parse($record->date);

            return match ($period) {
                'week' => $date->copy()->startOfWeek()->format('Y-m-d'),
                'month' => $date->format('Y-m'),
                default => $date->format('Y-m-d'),
            };
        });

        $trend = [];

        foreach ($this->buildTrendBuckets($period, $start, $end) as $key => $label) {
            /** @var Collection $group */
            $group = $grouped->get($key, collect());
            $present = $group->whereIn('attendance_status', ['checked_in', 'completed', 'late'])->count();

            $trend[] = [
                'label' => $label,
                'total' => $group->count(),
                'present' => $present,
                'late' => $group->where('attendance_status', 'late')->count(),
                'early' => $group->where('arrival_category', 'early')->count(),
                'attendance_rate' => $group->count() > 0 ? round(($present / $group->count()) * 100, 1) : 0,
            ];
        }

        return $trend;
    }

    /**
     * @return array<string, string>
     */
    private function buildTrendBuckets(string $period, Carbon $start, Carbon $end): array
    {
        $start = $start->copy()->startOfDay();
        $end = $end->copy()->startOfDay();

        if ($start->gt($end)) {
            [$start, $end] = [$end->copy(), $start->copy()];
        }

        $buckets = [];

        if ($period === 'week') {
            $cursor = $start->copy()->startOfWeek();
            while ($cursor->lte($end)) {
                $key = $cursor->format('Y-m-d');
                $buckets[$key] = 'Week of ' . $cursor->format('M d');
                $cursor->addWeek();
            }

            return $buckets;
        }

        if ($period === 'month') {
            $cursor = $start->copy()->startOfMonth();
            while ($cursor->lte($end)) {
                $key = $cursor->format('Y-m');
                $buckets[$key] = $cursor->format('M Y');
                $cursor->addMonth();
            }

            return $buckets;
        }

        $cursor = $start->copy();
        while ($cursor->lte($end)) {
            $key = $cursor->format('Y-m-d');
            $buckets[$key] = $cursor->format('M d');
            $cursor->addDay();
        }

        return $buckets;
    }

    private function verificationAnalytics(Collection $records): array
    {
        $total = max($records->count(), 1);
        $faceVerified = $records->where('face_verified', true)->count();
        $faceUnverified = $records->filter(fn (StaffAttendance $record) => !$record->face_verified)->count();
        $geoVerified = $records->where('check_in_within_range', true)->count();
        $geoFailed = $records->filter(fn (StaffAttendance $record) => !$record->check_in_within_range)->count();

        return [
            'face_success_rate' => round(($faceVerified / $total) * 100, 1),
            'face_failure_rate' => round(($faceUnverified / $total) * 100, 1),
            'geolocation_success_rate' => round(($geoVerified / $total) * 100, 1),
            'geolocation_failure_rate' => round(($geoFailed / $total) * 100, 1),
        ];
    }

    private function performanceAnalytics(Collection $records): array
    {
        $earlyRecords = $records->where('arrival_category', 'early');
        $presentRecords = $records->whereIn('attendance_status', ['checked_in', 'completed', 'late']);
        $earlyCount = $earlyRecords->count();
        $presentCount = max($presentRecords->count(), 1);

        $rankings = $records->groupBy('staff_id')->map(function (Collection $group) {
            $staff = $group->first()->staff;
            $total = $group->count();
            $present = $group->whereIn('attendance_status', ['checked_in', 'completed', 'late'])->count();
            $late = $group->where('attendance_status', 'late')->count();
            $early = $group->where('arrival_category', 'early')->count();
            $onTime = $group->where('arrival_category', 'on_time')->count();
            $rate = $total > 0 ? round(($present / $total) * 100, 1) : 0;
            $punctualityScore = $present > 0
                ? round((($onTime + $early) / $present) * 100 - (($late / $present) * 25), 1)
                : 0;

            return [
                'staff_id' => $staff?->id,
                'name' => trim(($staff?->first_name ?? '') . ' ' . ($staff?->last_name ?? '')),
                'department' => $staff?->department?->name ?? 'N/A',
                'total' => $total,
                'present' => $present,
                'late' => $late,
                'early' => $early,
                'on_time' => $onTime,
                'attendance_rate' => $rate,
                'punctuality_score' => $punctualityScore,
            ];
        })->values();

        return [
            'early_check_in_analytics' => [
                'total_early_check_ins' => $earlyCount,
                'average_minutes_early' => $earlyCount > 0 ? round($earlyRecords->avg('minutes_early'), 1) : 0,
                'early_arrival_percentage' => round(($earlyCount / $presentCount) * 100, 1),
            ],
            'most_punctual' => $rankings->sortByDesc('punctuality_score')->take(5)->values()->all(),
            'frequently_late' => $rankings->sortByDesc('late')->take(5)->values()->all(),
            'attendance_ranking' => $rankings->sortByDesc('attendance_rate')->values()->all(),
        ];
    }
}
