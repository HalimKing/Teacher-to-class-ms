<?php

namespace App\Services;

use App\Models\ActivityLog;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class SystemLogService
{
    public function __construct(
        private ActivityLogService $activityLogService
    ) {}

    public function getFilterOptions(): array
    {
        return [
            'categories' => [
                ActivityLogService::CATEGORY_AUTHENTICATION,
                ActivityLogService::CATEGORY_ATTENDANCE,
                ActivityLogService::CATEGORY_USER_MANAGEMENT,
                ActivityLogService::CATEGORY_TIMETABLE,
                ActivityLogService::CATEGORY_SYSTEM_SETTINGS,
                ActivityLogService::CATEGORY_SECURITY,
            ],
            'statuses' => [ActivityLogService::STATUS_SUCCESS, ActivityLogService::STATUS_FAILED],
            'roles' => ActivityLog::query()->distinct()->orderBy('actor_role')->pluck('actor_role')->filter()->values()->all(),
            'eventTypes' => ActivityLog::query()->distinct()->orderBy('event_type')->pluck('event_type')->filter()->values()->all(),
            'users' => ActivityLog::query()
                ->select(['actor_id', 'actor_name', 'actor_role', 'actor_type'])
                ->whereNotNull('actor_id')
                ->distinct()
                ->orderBy('actor_name')
                ->get()
                ->map(fn ($row) => [
                    'id' => $row->actor_id,
                    'name' => $row->actor_name,
                    'role' => $row->actor_role,
                    'type' => $row->actor_type,
                ])
                ->values()
                ->all(),
        ];
    }

    public function getSummaryCards(?Request $request = null): array
    {
        $today = Carbon::today();
        $base = $this->applyFilters(ActivityLog::query(), $request);

        $todayQuery = (clone $base)->whereDate('created_at', $today);

        return [
            [
                'title' => 'Total Activities Today',
                'value' => (string) (clone $todayQuery)->count(),
                'icon' => 'Activity',
            ],
            [
                'title' => 'Login Activities Today',
                'value' => (string) (clone $todayQuery)
                    ->where('event_category', ActivityLogService::CATEGORY_AUTHENTICATION)
                    ->whereIn('event_type', ['login', 'logout', 'failed_login'])
                    ->count(),
                'icon' => 'LogIn',
            ],
            [
                'title' => 'Attendance Activities Today',
                'value' => (string) (clone $todayQuery)
                    ->where('event_category', ActivityLogService::CATEGORY_ATTENDANCE)
                    ->count(),
                'icon' => 'Calendar',
            ],
            [
                'title' => 'Failed Actions Today',
                'value' => (string) (clone $todayQuery)
                    ->where('status', ActivityLogService::STATUS_FAILED)
                    ->count(),
                'icon' => 'XCircle',
            ],
            [
                'title' => 'Security Events Today',
                'value' => (string) (clone $todayQuery)
                    ->where('is_security_flag', true)
                    ->count(),
                'icon' => 'ShieldX',
            ],
        ];
    }

    public function getSecurityHighlights(?Request $request = null): array
    {
        $query = $this->applyFilters(ActivityLog::query(), $request)
            ->where(function (Builder $securityQuery) {
                $securityQuery->where('is_security_flag', true)
                    ->orWhere('status', ActivityLogService::STATUS_FAILED)
                    ->orWhereIn('event_type', [
                        'failed_login',
                        'permission_denied',
                        'face_verification_failed',
                        'geolocation_verification_failed',
                        'unauthorized_access',
                    ]);
            })
            ->latest('created_at')
            ->limit(8);

        return $query->get()->map(fn (ActivityLog $log) => $this->transformLog($log))->all();
    }

    public function paginateLogs(Request $request)
    {
        $perPage = min(max((int) $request->get('per_page', 15), 5), 100);
        $sortBy = $request->get('sort_by', 'created_at');
        $sortDir = strtolower((string) $request->get('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';

        $allowedSorts = [
            'created_at' => 'created_at',
            'actor_name' => 'actor_name',
            'event_type' => 'event_type',
            'event_category' => 'event_category',
            'status' => 'status',
            'ip_address' => 'ip_address',
        ];

        $column = $allowedSorts[$sortBy] ?? 'created_at';

        return $this->applyFilters(ActivityLog::query(), $request)
            ->orderBy($column, $sortDir)
            ->orderBy('id', 'desc')
            ->paginate($perPage)
            ->through(fn (ActivityLog $log) => $this->transformLog($log));
    }

    public function getLog(ActivityLog $activityLog): array
    {
        return $this->transformLog($activityLog, detailed: true);
    }

    public function getRecords(Request $request): Collection
    {
        return $this->applyFilters(ActivityLog::query(), $request)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (ActivityLog $log) => $this->transformLog($log, detailed: true));
    }

    public function exportRows(Collection $records): array
    {
        return $records->map(function (array $record) {
            return [
                'User' => $record['actor_name'],
                'Role' => $record['actor_role'],
                'Event Type' => $record['event_type'],
                'Category' => $record['event_category'],
                'Description' => $record['description'],
                'Status' => $record['status'],
                'IP Address' => $record['ip_address'] ?? '',
                'Route' => $record['route'] ?? '',
                'Date & Time' => $record['created_at'],
                'Security Flag' => $record['is_security_flag'] ? 'Yes' : 'No',
            ];
        })->all();
    }

    public function pruneExpiredLogs(): int
    {
        $days = max(1, (int) \App\Models\SystemSetting::getValue('log_retention_days', 90));
        $cutoff = Carbon::now()->subDays($days);

        return ActivityLog::query()->where('created_at', '<', $cutoff)->delete();
    }

    private function applyFilters(Builder $query, ?Request $request): Builder
    {
        if (!$request) {
            return $query;
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->search);
            $query->where(function (Builder $searchQuery) use ($search) {
                $searchQuery->where('description', 'like', "%{$search}%")
                    ->orWhere('actor_name', 'like', "%{$search}%")
                    ->orWhere('event_type', 'like', "%{$search}%")
                    ->orWhere('ip_address', 'like', "%{$search}%");
            });
        }

        if ($request->filled('actor_id') && $request->actor_id !== 'all') {
            $query->where('actor_id', (int) $request->actor_id);
        }

        if ($request->filled('actor_role') && $request->actor_role !== 'all') {
            $query->where('actor_role', $request->actor_role);
        }

        if ($request->filled('event_type') && $request->event_type !== 'all') {
            $query->where('event_type', $request->event_type);
        }

        if ($request->filled('event_category') && $request->event_category !== 'all') {
            $query->where('event_category', $request->event_category);
        }

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('ip_address')) {
            $query->where('ip_address', 'like', '%' . trim((string) $request->ip_address) . '%');
        }

        if ($request->filled('start_date')) {
            $query->whereDate('created_at', '>=', Carbon::parse($request->start_date)->toDateString());
        }

        if ($request->filled('end_date')) {
            $query->whereDate('created_at', '<=', Carbon::parse($request->end_date)->toDateString());
        }

        if ($request->boolean('security_only')) {
            $query->where('is_security_flag', true);
        }

        return $query;
    }

    private function transformLog(ActivityLog $log, bool $detailed = false): array
    {
        $data = [
            'id' => $log->id,
            'event_type' => $log->event_type,
            'event_category' => $log->event_category,
            'description' => $log->description,
            'status' => $log->status,
            'actor_name' => $log->actor_name,
            'actor_role' => $log->actor_role,
            'actor_id' => $log->actor_id,
            'actor_type' => $log->actor_type,
            'ip_address' => $log->ip_address,
            'route' => $log->route,
            'method' => $log->method,
            'is_security_flag' => $log->is_security_flag,
            'created_at' => $log->created_at?->format('Y-m-d H:i:s'),
            'created_at_human' => $log->created_at?->diffForHumans(),
        ];

        if ($detailed) {
            $data['user_agent'] = $log->user_agent;
            $data['metadata'] = $log->metadata ?? [];
            $data['browser'] = $this->parseBrowser($log->user_agent);
            $data['device'] = $this->parseDevice($log->user_agent);
        }

        return $data;
    }

    private function parseBrowser(?string $userAgent): string
    {
        if (!$userAgent) {
            return 'Unknown';
        }

        return match (true) {
            str_contains($userAgent, 'Edg/') => 'Microsoft Edge',
            str_contains($userAgent, 'Chrome/') => 'Chrome',
            str_contains($userAgent, 'Firefox/') => 'Firefox',
            str_contains($userAgent, 'Safari/') && !str_contains($userAgent, 'Chrome/') => 'Safari',
            default => 'Other',
        };
    }

    private function parseDevice(?string $userAgent): string
    {
        if (!$userAgent) {
            return 'Unknown';
        }

        return match (true) {
            str_contains($userAgent, 'Mobile') => 'Mobile',
            str_contains($userAgent, 'Tablet') => 'Tablet',
            default => 'Desktop',
        };
    }
}
