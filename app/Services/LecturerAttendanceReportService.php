<?php

namespace App\Services;

use App\Models\Course;
use App\Models\FaceVerificationAttempt;
use App\Models\Teacher;
use App\Models\TeacherAttendance;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class LecturerAttendanceReportService
{
    private const STATUS_COLUMN = 'status';

    public function __construct(
        private AdminTeacherAttendanceReportService $adminReportService,
    ) {}

    public function scopeRequest(Request $request, Teacher $teacher): Request
    {
        $scoped = clone $request;
        $scoped->merge(['teacher_id' => $teacher->id]);

        return $scoped;
    }

    public function getFilterOptions(Teacher $teacher): array
    {
        $courses = Course::query()
            ->where('teacher_id', $teacher->id)
            ->orderBy('name')
            ->get(['id', 'name', 'course_code'])
            ->map(fn (Course $course) => [
                'id' => $course->id,
                'name' => $course->name,
                'code' => $course->course_code ?? '',
            ])
            ->values()
            ->all();

        return [
            'courses' => $courses,
            'attendanceStatuses' => ['pending', 'present', 'absent', 'completed', 'incomplete', 'late', 'early_leave', 'overtime'],
            'arrivalCategories' => [
                ['value' => 'early', 'label' => 'Early Arrival'],
                ['value' => 'on_time', 'label' => 'On Time'],
                ['value' => 'late', 'label' => 'Late Arrival'],
            ],
            'sessionTypes' => [
                ['value' => 'normal', 'label' => 'Normal Sessions'],
                ['value' => 'rescheduled', 'label' => 'Rescheduled Sessions'],
            ],
            'daysOfWeek' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        ];
    }

    public function getDashboardData(Teacher $teacher, Request $request): array
    {
        $scoped = $this->scopeRequest($request, $teacher);
        $records = $this->adminReportService->getFilteredAttendanceRecords($scoped);
        $analytics = $this->adminReportService->getAnalytics($scoped);

        return [
            'summaryCards' => $this->buildSummaryCards($records, $scoped),
            'analytics' => $this->buildLecturerAnalytics($records, $analytics, $scoped),
            'insights' => $this->buildInsights($records, $scoped),
            'attendanceCalendar' => $this->buildCalendar($records),
        ];
    }

    public function paginateRecords(Teacher $teacher, Request $request)
    {
        return $this->adminReportService->paginateRecords($this->scopeRequest($request, $teacher));
    }

    public function getExportRows(Teacher $teacher, Request $request): array
    {
        $records = $this->adminReportService->getRecords($this->scopeRequest($request, $teacher));

        return $records->map(function (array $record) {
            return [
                'Date' => $record['date'],
                'Course' => $record['course'],
                'Class' => $record['classroom'] ?? '—',
                'Venue' => $record['classroom'] ?? '—',
                'Check-in Time' => $record['check_in_time'],
                'Check-out Time' => $record['check_out_time'],
                'Working Hours' => $record['working_hours'],
                'Attendance Status' => $record['attendance_status'],
                'Arrival Status' => $record['arrival_category_label'] ?? '—',
                'Minutes Early' => $record['minutes_early'] ?? '—',
                'Minutes Late' => $record['minutes_late'] ?? '—',
                'Face Verification' => $record['face_verification_status'],
                'Geolocation Status' => $record['geolocation_status'],
                'Session Type' => $record['reschedule_status'],
                'Original Schedule' => $this->formatScheduleForExport($record['reschedule'], 'original'),
                'Rescheduled Schedule' => $this->formatScheduleForExport($record['reschedule'], 'new'),
                'Attendance Source' => $record['attendance_source'],
            ];
        })->all();
    }

    public function getRecordDetail(Teacher $teacher, TeacherAttendance $attendance): array
    {
        $attendance->load([
            'course',
            'classroom',
            'timetable',
            'rescheduledSession.classroom',
            'rescheduledSession.timetable.classRoom',
            'academicYear',
        ]);

        $record = $this->adminReportService->transformAttendanceRecord($attendance);

        $attempts = FaceVerificationAttempt::query()
            ->where('teacher_id', $teacher->id)
            ->when($attendance->timetable_id, fn ($query) => $query->where('timetable_id', $attendance->timetable_id))
            ->whereDate('created_at', $attendance->date)
            ->orderByDesc('created_at')
            ->limit(10)
            ->get(['id', 'score', 'result', 'failure_reason', 'created_at'])
            ->map(fn (FaceVerificationAttempt $attempt) => [
                'id' => $attempt->id,
                'score' => $attempt->score,
                'result' => $attempt->result,
                'failure_reason' => $attempt->failure_reason,
                'created_at' => $attempt->created_at?->format('Y-m-d H:i:s'),
            ])
            ->values()
            ->all();

        return [
            'record' => $record,
            'verification_attempts' => $attempts,
            'timeline' => $this->buildSessionTimeline($attendance),
        ];
    }

    private function buildSummaryCards(Collection $records, Request $request): array
    {
        $present = $records->filter(fn ($record) => $this->isPresent($record))->count();
        $missed = $records->where(self::STATUS_COLUMN, 'absent')->count();
        $late = $records->filter(fn ($record) => $this->isLate($record))->count();
        $total = $records->count();
        $attendanceRate = $total > 0 ? round(($present / $total) * 100, 1) : 0;

        $presentDays = $records->filter(fn ($record) => $this->isPresent($record))
            ->pluck('date')
            ->map(fn ($date) => Carbon::parse($date)->toDateString())
            ->unique()
            ->count();

        $absentDays = $records->where(self::STATUS_COLUMN, 'absent')
            ->pluck('date')
            ->map(fn ($date) => Carbon::parse($date)->toDateString())
            ->unique()
            ->count();

        $early = $records->where('arrival_category', 'early')->count();
        $onTime = $records->where('arrival_category', 'on_time')->count();
        $lateArrivals = $records->where('arrival_category', 'late')->count();
        $avgLateMinutes = round($records->where('minutes_late', '>', 0)->avg('minutes_late') ?? 0, 1);

        $faceVerified = $records->where('face_verified', true)->count();
        $geoVerified = $records->where('check_in_within_range', true)->count();
        $faceRate = $total > 0 ? round(($faceVerified / $total) * 100, 1) : 0;
        $faceFailureRate = $total > 0 ? round(100 - $faceRate, 1) : 0;
        $geoRate = $total > 0 ? round(($geoVerified / $total) * 100, 1) : 0;
        $geoFailureRate = $total > 0 ? round(100 - $geoRate, 1) : 0;

        $totalMinutes = 0;
        $sessionsWithHours = 0;
        foreach ($records as $record) {
            if ($record->check_in_time && $record->check_out_time) {
                try {
                    $start = Carbon::parse($record->check_in_time);
                    $end = Carbon::parse($record->check_out_time);
                    $totalMinutes += $start->diffInMinutes($end);
                    $sessionsWithHours++;
                } catch (\Throwable) {
                    continue;
                }
            }
        }

        $totalHours = round($totalMinutes / 60, 1);
        $weeksInRange = max(1, $this->weeksInRange($request));
        $avgHoursPerWeek = round($totalHours / $weeksInRange, 1);

        $checkIns = $records->pluck('check_in_time')->filter()->all();
        $checkOuts = $records->pluck('check_out_time')->filter()->all();
        $avgCheckIn = $this->averageTimeLabel($checkIns);
        $avgCheckOut = $this->averageTimeLabel($checkOuts);

        $previousRate = $this->previousPeriodRate($request);
        $rateChange = $previousRate > 0 ? round((($attendanceRate - $previousRate) / $previousRate) * 100, 1) : 0;

        return [
            ['title' => 'Total Sessions', 'value' => (string) $total, 'change' => 'In selected range', 'changeType' => 'neutral', 'icon' => 'Calendar', 'group' => 'attendance'],
            ['title' => 'Sessions Attended', 'value' => (string) $present, 'change' => $total > 0 ? round(($present / $total) * 100, 1) . '% of sessions' : '', 'changeType' => 'positive', 'icon' => 'CheckCircle', 'group' => 'attendance'],
            ['title' => 'Sessions Missed', 'value' => (string) $missed, 'change' => $total > 0 ? round(($missed / $total) * 100, 1) . '% missed' : '', 'changeType' => $missed > 0 ? 'negative' : 'neutral', 'icon' => 'XCircle', 'group' => 'attendance'],
            ['title' => 'Attendance Rate', 'value' => $attendanceRate . '%', 'change' => ($rateChange >= 0 ? '+' : '') . $rateChange . '% vs prior period', 'changeType' => $rateChange >= 0 ? 'positive' : 'negative', 'icon' => 'TrendingUp', 'group' => 'attendance'],
            ['title' => 'Present Days', 'value' => (string) $presentDays, 'change' => 'Unique dates with attendance', 'changeType' => 'positive', 'icon' => 'Calendar', 'group' => 'attendance'],
            ['title' => 'Absent Days', 'value' => (string) $absentDays, 'change' => 'Unique missed dates', 'changeType' => $absentDays > 0 ? 'negative' : 'neutral', 'icon' => 'XCircle', 'group' => 'attendance'],
            ['title' => 'Early Arrivals', 'value' => (string) $early, 'change' => '', 'changeType' => 'positive', 'icon' => 'LogIn', 'group' => 'punctuality'],
            ['title' => 'On-Time Arrivals', 'value' => (string) $onTime, 'change' => '', 'changeType' => 'neutral', 'icon' => 'Clock', 'group' => 'punctuality'],
            ['title' => 'Late Arrivals', 'value' => (string) $lateArrivals, 'change' => $late > 0 ? "{$late} late status records" : '', 'changeType' => $lateArrivals > 0 ? 'negative' : 'neutral', 'icon' => 'Clock', 'group' => 'punctuality'],
            ['title' => 'Avg Late Minutes', 'value' => (string) $avgLateMinutes, 'change' => 'When late', 'changeType' => $avgLateMinutes > 0 ? 'negative' : 'neutral', 'icon' => 'Clock', 'group' => 'punctuality'],
            ['title' => 'Face Success Rate', 'value' => $faceRate . '%', 'change' => $faceFailureRate . '% failure rate', 'changeType' => 'positive', 'icon' => 'ShieldCheck', 'group' => 'verification'],
            ['title' => 'Face Failure Rate', 'value' => $faceFailureRate . '%', 'change' => ($total - $faceVerified) . ' unverified records', 'changeType' => $faceFailureRate > 0 ? 'negative' : 'neutral', 'icon' => 'ShieldX', 'group' => 'verification'],
            ['title' => 'Geo Success Rate', 'value' => $geoRate . '%', 'change' => $geoFailureRate . '% failure rate', 'changeType' => 'positive', 'icon' => 'MapPin', 'group' => 'verification'],
            ['title' => 'Geo Failure Rate', 'value' => $geoFailureRate . '%', 'change' => ($total - $geoVerified) . ' failed records', 'changeType' => $geoFailureRate > 0 ? 'negative' : 'neutral', 'icon' => 'MapPin', 'group' => 'verification'],
            ['title' => 'Total Hours Worked', 'value' => (string) $totalHours, 'change' => "{$sessionsWithHours} completed sessions", 'changeType' => 'neutral', 'icon' => 'Activity', 'group' => 'productivity'],
            ['title' => 'Avg Hours / Week', 'value' => (string) $avgHoursPerWeek, 'change' => "{$weeksInRange} weeks in range", 'changeType' => 'neutral', 'icon' => 'Activity', 'group' => 'productivity'],
            ['title' => 'Avg Check-In Time', 'value' => $avgCheckIn ?? '—', 'change' => '', 'changeType' => 'neutral', 'icon' => 'LogIn', 'group' => 'productivity'],
            ['title' => 'Avg Check-Out Time', 'value' => $avgCheckOut ?? '—', 'change' => '', 'changeType' => 'neutral', 'icon' => 'LogOut', 'group' => 'productivity'],
        ];
    }

    private function buildLecturerAnalytics(Collection $records, array $analytics, Request $request): array
    {
        $rescheduled = $records->whereNotNull('rescheduled_session_id')->count();
        $present = $records->filter(fn ($record) => $this->isPresent($record))->count();
        $absent = $records->where(self::STATUS_COLUMN, 'absent')->count();
        $late = $records->filter(fn ($record) => $this->isLate($record))->count();

        $courseRanking = $records->groupBy('course_id')->map(function (Collection $group) {
            $course = $group->first()->course;
            $total = $group->count();
            $presentCount = $group->filter(fn ($record) => $this->isPresent($record))->count();

            return [
                'name' => $course?->name ?? 'Unknown',
                'department' => '',
                'attendance_rate' => $total > 0 ? round(($presentCount / $total) * 100, 1) : 0,
                'late' => $group->filter(fn ($record) => $this->isLate($record))->count(),
                'present' => $presentCount,
                'total' => $total,
            ];
        })->sortByDesc('attendance_rate')->values()->take(8)->all();

        $punctuality = [
            ['label' => 'Early', 'value' => $records->where('arrival_category', 'early')->count()],
            ['label' => 'On Time', 'value' => $records->where('arrival_category', 'on_time')->count()],
            ['label' => 'Late', 'value' => $records->where('arrival_category', 'late')->count()],
        ];

        return array_merge($analytics, [
            'attendanceBreakdown' => [
                ['label' => 'Present', 'value' => $present],
                ['label' => 'Absent', 'value' => $absent],
                ['label' => 'Late', 'value' => $late],
                ['label' => 'Rescheduled', 'value' => $rescheduled],
            ],
            'punctualityAnalytics' => $punctuality,
            'performanceAnalytics' => [
                'most_punctual' => [],
                'frequently_late' => [],
                'attendance_ranking' => $courseRanking,
                'highest_attendance' => $courseRanking[0] ?? null,
                'lowest_attendance' => $courseRanking[count($courseRanking) - 1] ?? null,
            ],
        ]);
    }

    private function buildInsights(Collection $records, Request $request): array
    {
        $total = $records->count();
        $present = $records->filter(fn ($record) => $this->isPresent($record))->count();
        $attendanceRate = $total > 0 ? round(($present / $total) * 100, 1) : 0;

        $monthly = $records->groupBy(fn ($record) => Carbon::parse($record->date)->format('Y-m'))
            ->map(function (Collection $monthRecords, string $month) {
                $presentCount = $monthRecords->filter(fn ($record) => $this->isPresent($record))->count();
                $totalCount = $monthRecords->count();

                return [
                    'month' => Carbon::createFromFormat('Y-m', $month)->format('M Y'),
                    'rate' => $totalCount > 0 ? round(($presentCount / $totalCount) * 100, 1) : 0,
                    'total' => $totalCount,
                ];
            })
            ->sortByDesc('rate')
            ->values();

        $bestMonth = $monthly->first();

        $mostTaught = $records->groupBy('course_id')
            ->map(fn (Collection $group) => ['name' => $group->first()->course?->name ?? 'Unknown', 'count' => $group->count()])
            ->sortByDesc('count')
            ->first();

        $mostRescheduled = $records->whereNotNull('rescheduled_session_id')
            ->groupBy('course_id')
            ->map(fn (Collection $group) => ['name' => $group->first()->course?->name ?? 'Unknown', 'count' => $group->count()])
            ->sortByDesc('count')
            ->first();

        $streak = $this->longestPresentStreak($records);
        $complianceScore = $this->complianceScore($records);

        $previousRate = $this->previousPeriodRate($request);
        $delta = round($attendanceRate - $previousRate, 1);

        return [
            [
                'title' => 'Best Attendance Month',
                'value' => $bestMonth['month'] ?? 'N/A',
                'detail' => isset($bestMonth['rate']) ? "{$bestMonth['rate']}% attendance ({$bestMonth['total']} sessions)" : 'No data in range',
                'tone' => 'positive',
            ],
            [
                'title' => 'Longest Attendance Streak',
                'value' => $streak > 0 ? "{$streak} days" : 'N/A',
                'detail' => $streak > 0 ? 'Consecutive days with attended sessions' : 'No streak recorded',
                'tone' => $streak >= 5 ? 'positive' : 'neutral',
            ],
            [
                'title' => 'Average Attendance Rate',
                'value' => "{$attendanceRate}%",
                'detail' => ($delta >= 0 ? '+' : '') . "{$delta}% compared to previous period",
                'tone' => $delta >= 0 ? 'positive' : 'negative',
            ],
            [
                'title' => 'Most Frequently Taught Course',
                'value' => $mostTaught['name'] ?? 'N/A',
                'detail' => isset($mostTaught['count']) ? "{$mostTaught['count']} sessions in range" : 'No sessions',
                'tone' => 'neutral',
            ],
            [
                'title' => 'Most Rescheduled Course',
                'value' => $mostRescheduled['name'] ?? 'N/A',
                'detail' => isset($mostRescheduled['count']) ? "{$mostRescheduled['count']} rescheduled sessions" : 'No rescheduled sessions',
                'tone' => 'neutral',
            ],
            [
                'title' => 'Attendance Compliance Score',
                'value' => "{$complianceScore}/100",
                'detail' => 'Weighted score across attendance, punctuality, verification, and completion',
                'tone' => $complianceScore >= 80 ? 'positive' : ($complianceScore >= 60 ? 'neutral' : 'negative'),
            ],
        ];
    }

    private function buildCalendar(Collection $records): array
    {
        return $records->groupBy(fn ($record) => Carbon::parse($record->date)->toDateString())
            ->map(function (Collection $dayRecords, string $date) {
                $status = $dayRecords->contains(fn ($record) => $record->status === 'absent')
                    ? 'absent'
                    : ($dayRecords->contains(fn ($record) => $this->isLate($record)) ? 'late' : 'present');

                return [
                    'date' => $date,
                    'status' => $status,
                    'count' => $dayRecords->count(),
                ];
            })
            ->values()
            ->all();
    }

    private function buildSessionTimeline(TeacherAttendance $attendance): array
    {
        $events = [];

        if ($attendance->auto_generated) {
            $events[] = [
                'label' => 'Auto-absence recorded',
                'time' => $attendance->auto_generated_at?->format('Y-m-d H:i:s'),
                'detail' => $attendance->auto_absence_reason,
            ];
        }

        if ($attendance->check_in_time) {
            $events[] = [
                'label' => 'Checked in',
                'time' => Carbon::parse($attendance->check_in_time)->format('Y-m-d H:i:s'),
                'detail' => $attendance->arrival_category ? ucfirst(str_replace('_', ' ', $attendance->arrival_category)) : null,
            ];
        }

        if ($attendance->face_verified_at) {
            $events[] = [
                'label' => 'Face verified',
                'time' => $attendance->face_verified_at->format('Y-m-d H:i:s'),
                'detail' => $attendance->face_match_score !== null ? "Score: {$attendance->face_match_score}" : null,
            ];
        }

        if ($attendance->check_out_time) {
            $events[] = [
                'label' => 'Checked out',
                'time' => Carbon::parse($attendance->check_out_time)->format('Y-m-d H:i:s'),
                'detail' => $attendance->departure_category ? ucfirst(str_replace('_', ' ', $attendance->departure_category)) : null,
            ];
        }

        return $events;
    }

    private function complianceScore(Collection $records): int
    {
        $total = max(1, $records->count());
        $present = $records->filter(fn ($record) => $this->isPresent($record))->count();
        $onTimeOrEarly = $records->whereIn('arrival_category', ['early', 'on_time'])->count();
        $faceVerified = $records->where('face_verified', true)->count();
        $completed = $records->filter(fn ($record) => !empty($record->check_out_time))->count();

        $attendanceScore = ($present / $total) * 40;
        $punctualityScore = ($onTimeOrEarly / $total) * 25;
        $verificationScore = ($faceVerified / $total) * 20;
        $completionScore = ($completed / $total) * 15;

        return (int) round($attendanceScore + $punctualityScore + $verificationScore + $completionScore);
    }

    private function longestPresentStreak(Collection $records): int
    {
        $dates = $records->filter(fn ($record) => $this->isPresent($record))
            ->pluck('date')
            ->map(fn ($date) => Carbon::parse($date)->toDateString())
            ->unique()
            ->sort()
            ->values();

        if ($dates->isEmpty()) {
            return 0;
        }

        $longest = 1;
        $current = 1;

        for ($i = 1; $i < $dates->count(); $i++) {
            $prev = Carbon::parse($dates[$i - 1]);
            $curr = Carbon::parse($dates[$i]);

            if ($prev->copy()->addDay()->toDateString() === $curr->toDateString()) {
                $current++;
                $longest = max($longest, $current);
            } else {
                $current = 1;
            }
        }

        return $longest;
    }

    private function previousPeriodRate(Request $request): float
    {
        $start = $request->filled('start_date') ? Carbon::parse($request->start_date) : now()->subMonth();
        $end = $request->filled('end_date') ? Carbon::parse($request->end_date) : now();
        $days = max(1, $start->diffInDays($end) + 1);

        $previousStart = $start->copy()->subDays($days);
        $previousEnd = $start->copy()->subDay();

        $scoped = clone $request;
        $scoped->merge([
            'start_date' => $previousStart->toDateString(),
            'end_date' => $previousEnd->toDateString(),
        ]);

        $previous = $this->adminReportService->getFilteredAttendanceRecords($scoped);
        if ($previous->isEmpty()) {
            return 0;
        }

        $present = $previous->filter(fn ($record) => $this->isPresent($record))->count();

        return round(($present / $previous->count()) * 100, 1);
    }

    private function weeksInRange(Request $request): int
    {
        $start = $request->filled('start_date') ? Carbon::parse($request->start_date) : now()->subMonth();
        $end = $request->filled('end_date') ? Carbon::parse($request->end_date) : now();

        return max(1, (int) ceil(($start->diffInDays($end) + 1) / 7));
    }

    private function averageTimeLabel(array $times): ?string
    {
        if (empty($times)) {
            return null;
        }

        $totalMinutes = 0;
        $count = 0;

        foreach ($times as $time) {
            try {
                $parsed = Carbon::parse($time);
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

    private function formatScheduleForExport(?array $reschedule, string $type): string
    {
        if (!$reschedule) {
            return '—';
        }

        if ($type === 'original') {
            return trim(($reschedule['original_date_display'] ?? '') . ', ' . ($reschedule['original_start_time_display'] ?? '') . ' – ' . ($reschedule['original_end_time_display'] ?? '') . ', ' . ($reschedule['original_venue'] ?? '—'));
        }

        return trim(($reschedule['new_date_display'] ?? '') . ', ' . ($reschedule['new_start_time_display'] ?? '') . ' – ' . ($reschedule['new_end_time_display'] ?? '') . ', ' . ($reschedule['new_venue'] ?? '—'));
    }

    private function isPresent(object $record): bool
    {
        return in_array($record->{self::STATUS_COLUMN} ?? null, [
            'checked_in', 'completed', 'late', 'present', 'pending', 'incomplete', 'overtime', 'early_leave',
        ], true);
    }

    private function isLate(object $record): bool
    {
        return ($record->{self::STATUS_COLUMN} ?? null) === 'late'
            || ($record->arrival_category ?? null) === 'late';
    }
}
