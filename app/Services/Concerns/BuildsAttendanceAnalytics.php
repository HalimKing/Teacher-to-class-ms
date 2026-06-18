<?php

namespace App\Services\Concerns;

use Carbon\Carbon;
use Illuminate\Support\Collection;

trait BuildsAttendanceAnalytics
{
    protected function presentStatuses(): array
    {
        return ['checked_in', 'completed', 'late', 'present'];
    }

    protected function isPresentRecord(object $record, string $statusColumn): bool
    {
        return in_array($record->{$statusColumn} ?? null, $this->presentStatuses(), true);
    }

    protected function isLateRecord(object $record, string $statusColumn): bool
    {
        return ($record->{$statusColumn} ?? null) === 'late';
    }

    protected function calculateWorkingHours(?string $checkIn, ?string $checkOut): ?string
    {
        if (!$checkIn || !$checkOut) {
            return null;
        }

        try {
            $start = $this->parseFlexibleTime($checkIn);
            $end = $this->parseFlexibleTime($checkOut);
            $minutes = $start->diffInMinutes($end);

            return sprintf('%02d:%02d', intdiv($minutes, 60), $minutes % 60);
        } catch (\Throwable) {
            return null;
        }
    }

    protected function formatTime(?string $time): ?string
    {
        if (!$time) {
            return null;
        }

        try {
            return $this->parseFlexibleTime($time)->format('h:i A');
        } catch (\Throwable) {
            return $time;
        }
    }

    protected function averageTime(array $times): ?string
    {
        if (empty($times)) {
            return null;
        }

        $totalMinutes = 0;
        $count = 0;

        foreach ($times as $time) {
            try {
                $parsed = $this->parseFlexibleTime($time);
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

    protected function parseFlexibleTime(string $time): Carbon
    {
        $normalized = trim($time);

        foreach (['H:i:s', 'H:i', 'g:i A', 'h:i A'] as $format) {
            try {
                return Carbon::createFromFormat($format, $normalized);
            } catch (\Throwable) {
                continue;
            }
        }

        return Carbon::parse($normalized);
    }

    protected function averageWorkingHours(Collection $records): ?string
    {
        $durations = $records->map(function ($record) {
            return $this->calculateWorkingHours($record->check_in_time, $record->check_out_time);
        })->filter()->values();

        if ($durations->isEmpty()) {
            return null;
        }

        $totalMinutes = 0;
        $count = 0;

        foreach ($durations as $duration) {
            [$hours, $minutes] = array_map('intval', explode(':', $duration));
            $totalMinutes += ($hours * 60) + $minutes;
            $count++;
        }

        if ($count === 0) {
            return null;
        }

        $average = intdiv($totalMinutes, $count);

        return sprintf('%02d:%02d', intdiv($average, 60), $average % 60);
    }

    protected function groupTrend(Collection $records, string $period, string $statusColumn, ?Carbon $start = null, ?Carbon $end = null): array
    {
        if ($start !== null && $end !== null) {
            return $this->groupTrendForRange($records, $period, $statusColumn, $start, $end);
        }

        return $records->groupBy(function ($record) use ($period) {
            $date = Carbon::parse($record->date);

            return match ($period) {
                'week' => $date->copy()->startOfWeek()->format('Y-m-d'),
                'month' => $date->format('Y-m'),
                default => $date->format('Y-m-d'),
            };
        })->map(function (Collection $group, string $key) use ($period, $statusColumn) {
            $present = $group->filter(fn ($record) => $this->isPresentRecord($record, $statusColumn))->count();

            return [
                'label' => $this->formatTrendBucketLabel($period, $key),
                'total' => $group->count(),
                'present' => $present,
                'late' => $group->filter(fn ($record) => $this->isLateRecord($record, $statusColumn))->count(),
                'absent' => $group->filter(fn ($record) => ($record->{$statusColumn} ?? null) === 'absent')->count(),
                'attendance_rate' => $group->count() > 0 ? round(($present / $group->count()) * 100, 1) : 0,
            ];
        })->sortKeys()->values()->all();
    }

    protected function groupTrendForRange(
        Collection $records,
        string $period,
        string $statusColumn,
        Carbon $start,
        Carbon $end,
    ): array {
        $grouped = $records->groupBy(function ($record) use ($period) {
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
            $present = $group->filter(fn ($record) => $this->isPresentRecord($record, $statusColumn))->count();

            $trend[] = [
                'label' => $label,
                'total' => $group->count(),
                'present' => $present,
                'late' => $group->filter(fn ($record) => $this->isLateRecord($record, $statusColumn))->count(),
                'absent' => $group->filter(fn ($record) => ($record->{$statusColumn} ?? null) === 'absent')->count(),
                'attendance_rate' => $group->count() > 0 ? round(($present / $group->count()) * 100, 1) : 0,
            ];
        }

        return $trend;
    }

    /**
     * @return array<string, string>
     */
    protected function buildTrendBuckets(string $period, Carbon $start, Carbon $end): array
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
                $buckets[$key] = $this->formatTrendBucketLabel('week', $key);
                $cursor->addWeek();
            }

            return $buckets;
        }

        if ($period === 'month') {
            $cursor = $start->copy()->startOfMonth();
            while ($cursor->lte($end)) {
                $key = $cursor->format('Y-m');
                $buckets[$key] = $this->formatTrendBucketLabel('month', $key);
                $cursor->addMonth();
            }

            return $buckets;
        }

        $cursor = $start->copy();
        while ($cursor->lte($end)) {
            $key = $cursor->format('Y-m-d');
            $buckets[$key] = $this->formatTrendBucketLabel('day', $key);
            $cursor->addDay();
        }

        return $buckets;
    }

    protected function formatTrendBucketLabel(string $period, string $key): string
    {
        return match ($period) {
            'week' => 'Week of ' . Carbon::parse($key)->format('M d'),
            'month' => Carbon::createFromFormat('Y-m', $key)->format('M Y'),
            default => Carbon::parse($key)->format('M d'),
        };
    }

    protected function resolveReportDateRange(?string $startDate, ?string $endDate): array
    {
        $end = $endDate ? Carbon::parse($endDate)->startOfDay() : Carbon::today();
        $start = $startDate ? Carbon::parse($startDate)->startOfDay() : $end->copy()->subMonth();

        if ($start->gt($end)) {
            [$start, $end] = [$end->copy(), $start->copy()];
        }

        return [$start, $end];
    }

    protected function verificationAnalytics(Collection $records): array
    {
        $total = max($records->count(), 1);
        $faceVerified = $records->where('face_verified', true)->count();
        $faceUnverified = $records->filter(fn ($record) => !$record->face_verified)->count();
        $geoVerified = $records->where('check_in_within_range', true)->count();
        $geoFailed = $records->filter(fn ($record) => !$record->check_in_within_range)->count();

        return [
            'face_success_rate' => round(($faceVerified / $total) * 100, 1),
            'face_failure_rate' => round(($faceUnverified / $total) * 100, 1),
            'geolocation_success_rate' => round(($geoVerified / $total) * 100, 1),
            'geolocation_failure_rate' => round(($geoFailed / $total) * 100, 1),
        ];
    }

    protected function verificationTrendOverTime(Collection $records, string $statusColumn, ?Carbon $start = null, ?Carbon $end = null): array
    {
        return $this->groupTrend($records, 'day', $statusColumn, $start, $end);
    }

    protected function performanceAnalytics(Collection $records, string $groupKey, string $statusColumn, callable $personResolver): array
    {
        $rankings = $records->groupBy($groupKey)->map(function (Collection $group) use ($personResolver, $statusColumn) {
            $person = $personResolver($group->first());
            $total = $group->count();
            $present = $group->filter(fn ($record) => $this->isPresentRecord($record, $statusColumn))->count();
            $late = $group->filter(fn ($record) => $this->isLateRecord($record, $statusColumn))->count();
            $rate = $total > 0 ? round(($present / $total) * 100, 1) : 0;

            return [
                'staff_id' => $person['id'] ?? null,
                'name' => $person['name'] ?? 'Unknown',
                'department' => $person['department'] ?? 'N/A',
                'total' => $total,
                'present' => $present,
                'late' => $late,
                'attendance_rate' => $rate,
            ];
        })->values();

        $sorted = $rankings->sortByDesc('attendance_rate')->values();

        return [
            'most_punctual' => $sorted->take(5)->values()->all(),
            'frequently_late' => $rankings->sortByDesc('late')->take(5)->values()->all(),
            'attendance_ranking' => $sorted->all(),
            'highest_attendance' => $sorted->first(),
            'lowest_attendance' => $sorted->last(),
        ];
    }

    protected function attendanceCalendar(Collection $records, string $statusColumn): array
    {
        return $records->map(function ($record) use ($statusColumn) {
            return [
                'date' => Carbon::parse($record->date)->format('Y-m-d'),
                'status' => $record->{$statusColumn},
                'present' => $this->isPresentRecord($record, $statusColumn),
                'late' => $this->isLateRecord($record, $statusColumn),
            ];
        })->values()->all();
    }
}
