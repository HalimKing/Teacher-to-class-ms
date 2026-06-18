<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;

class AdminUserManagementService
{
    public function getIndexPayload(Request $request): array
    {
        return [
            'summaryCards' => $this->getSummaryCards(),
            'users' => $this->paginateUsers($request),
            'roles' => Role::query()->orderBy('name')->get(['id', 'name']),
            'filters' => $this->currentFilters($request),
            'statusOptions' => User::STATUSES,
        ];
    }

    public function getQuickView(User $user): array
    {
        $user->load('roles.permissions');

        $recentActivity = ActivityLog::query()
            ->where(function (Builder $query) use ($user) {
                $query->where(function (Builder $actorQuery) use ($user) {
                    $actorQuery->where('actor_type', User::class)
                        ->where('actor_id', $user->id);
                })->orWhere(function (Builder $metadataQuery) use ($user) {
                    $metadataQuery->whereJsonContains('metadata->user_id', $user->id)
                        ->orWhereJsonContains('metadata->target_user_id', $user->id);
                });
            })
            ->latest()
            ->limit(8)
            ->get(['event_type', 'description', 'created_at', 'event_category'])
            ->map(fn (ActivityLog $log) => [
                'event_type' => $log->event_type,
                'description' => $log->description,
                'category' => $log->event_category,
                'created_at' => $log->created_at?->format('M d, Y g:i A'),
            ])
            ->values()
            ->all();

        $passwordResets = ActivityLog::query()
            ->where('event_type', 'admin_password_reset')
            ->whereJsonContains('metadata->target_user_id', $user->id)
            ->latest()
            ->limit(5)
            ->get(['created_at', 'metadata'])
            ->map(fn (ActivityLog $log) => [
                'created_at' => $log->created_at?->format('M d, Y g:i A'),
                'method' => $log->metadata['method'] ?? 'unknown',
            ])
            ->values()
            ->all();

        return [
            'profile' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'staff_id' => $user->staff_id,
                'status' => $user->status ?? User::STATUS_ACTIVE,
                'created_at' => $user->created_at?->format('M d, Y'),
                'last_login_at' => $user->last_login_at?->format('M d, Y g:i A'),
                'initials' => $this->initials($user->name),
            ],
            'security' => [
                'account_status' => $user->status ?? User::STATUS_ACTIVE,
                'locked' => $user->locked_at !== null,
                'password_status' => $user->passwordStatusLabel(),
                'must_change_password' => (bool) $user->must_change_password,
                'password_changed_at' => $user->password_changed_at?->format('M d, Y g:i A'),
                'password_reset_history' => $passwordResets,
                'active_sessions' => DB::table('sessions')->where('user_id', $user->id)->count(),
            ],
            'permissions' => [
                'roles' => $user->roles->pluck('name')->values()->all(),
                'permissions' => $user->getAllPermissions()->pluck('name')->values()->take(20)->all(),
            ],
            'activity' => $recentActivity,
        ];
    }

    public function filteredQuery(Request $request): Builder
    {
        $query = User::query()->with('roles');

        $this->applyFilters($query, $request);
        $this->applySorting($query, $request);

        return $query;
    }

    public function exportRows(Request $request): array
    {
        return $this->filteredQuery($request)
            ->get()
            ->map(fn (User $user) => $this->transformUser($user))
            ->map(fn (array $row) => [
                'Name' => $row['name'],
                'Staff ID' => $row['staff_id'],
                'Email' => $row['email'],
                'Roles' => implode(', ', $row['roles']),
                'Status' => $row['status_label'],
                'Password Status' => $row['password_status'],
                'Last Login' => $row['last_login_display'] ?? '—',
                'Created' => $row['created_at'],
            ])
            ->all();
    }

    public function updateStatus(User $user, string $status): User
    {
        if (!in_array($status, User::STATUSES, true)) {
            abort(422, 'Invalid account status.');
        }

        $user->status = $status;

        if ($status === User::STATUS_ACTIVE) {
            $user->locked_at = null;
        }

        $user->save();

        app(ActivityLogService::class)->logUserManagement(
            'user_status_changed',
            "Changed status for {$user->name} to {$status}",
            ['user_id' => $user->id, 'status' => $status]
        );

        return $user;
    }

    public function bulkUpdateStatus(User $actor, array $ids, string $status): array
    {
        $updated = 0;
        $skipped = 0;

        foreach (User::query()->whereIn('id', $ids)->get() as $user) {
            if ($user->id === $actor->id || !$actor->can('update', $user)) {
                $skipped++;
                continue;
            }

            $this->updateStatus($user, $status);
            $updated++;
        }

        return compact('updated', 'skipped');
    }

    public function bulkRequirePasswordChange(User $actor, array $ids): array
    {
        $updated = 0;
        $skipped = 0;

        foreach (User::query()->whereIn('id', $ids)->get() as $user) {
            if ($user->id === $actor->id || !$actor->can('update', $user)) {
                $skipped++;
                continue;
            }

            $user->must_change_password = true;
            $user->save();

            app(ActivityLogService::class)->logUserManagement(
                'user_password_change_required',
                "Password change required on next login for {$user->name}",
                ['user_id' => $user->id]
            );

            $updated++;
        }

        return compact('updated', 'skipped');
    }

    public function bulkDelete(User $actor, array $ids): array
    {
        $deleted = 0;
        $skipped = 0;

        foreach (User::query()->whereIn('id', $ids)->get() as $user) {
            if (!$actor->can('delete', $user)) {
                $skipped++;
                continue;
            }

            $name = $user->name;
            $email = $user->email;
            $userId = $user->id;
            $user->delete();

            app(ActivityLogService::class)->logUserManagement(
                'user_deleted',
                "Deleted admin user {$name} ({$email})",
                ['user_id' => $userId, 'bulk' => true]
            );

            $deleted++;
        }

        return compact('deleted', 'skipped');
    }

    private function paginateUsers(Request $request)
    {
        $perPage = min(max((int) $request->get('per_page', 15), 5), 100);

        return $this->filteredQuery($request)
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn (User $user) => $this->transformUser($user));
    }

    private function applyFilters(Builder $query, Request $request): void
    {
        if ($request->filled('search')) {
            $search = trim((string) $request->search);
            $query->where(function (Builder $inner) use ($search) {
                $inner->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('staff_id', 'like', "%{$search}%");
            });
        }

        if ($request->filled('ids')) {
            $ids = collect(explode(',', (string) $request->ids))
                ->map(fn ($id) => (int) trim($id))
                ->filter(fn ($id) => $id > 0)
                ->values()
                ->all();

            if (!empty($ids)) {
                $query->whereIn('id', $ids);
            }
        }

        if ($request->filled('role') && $request->role !== 'all') {
            $query->whereHas('roles', fn (Builder $roleQuery) => $roleQuery->where('name', $request->role));
        }

        if ($request->filled('status') && $request->status !== 'all') {
            if ($request->status === 'locked') {
                $query->whereNotNull('locked_at');
            } else {
                $query->where('status', $request->status);
            }
        }

        if ($request->filled('password_status') && $request->password_status !== 'all') {
            if ($request->password_status === 'reset_required') {
                $query->where('must_change_password', true);
            } elseif ($request->password_status === 'current') {
                $query->where('must_change_password', false);
            }
        }

        if ($request->filled('login_status') && $request->login_status !== 'all') {
            if ($request->login_status === 'never') {
                $query->whereNull('last_login_at');
            } elseif ($request->login_status === 'recent') {
                $query->where('last_login_at', '>=', now()->subDays(7));
            }
        }

        if ($request->filled('created_from')) {
            $query->whereDate('created_at', '>=', Carbon::parse($request->created_from)->toDateString());
        }

        if ($request->filled('created_to')) {
            $query->whereDate('created_at', '<=', Carbon::parse($request->created_to)->toDateString());
        }

        if ($request->filled('last_login_from')) {
            $query->whereDate('last_login_at', '>=', Carbon::parse($request->last_login_from)->toDateString());
        }

        if ($request->filled('last_login_to')) {
            $query->whereDate('last_login_at', '<=', Carbon::parse($request->last_login_to)->toDateString());
        }
    }

    private function applySorting(Builder $query, Request $request): void
    {
        $sortBy = $request->get('sort_by', 'created_at');
        $sortDir = strtolower((string) $request->get('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';

        $allowed = [
            'name' => 'name',
            'email' => 'email',
            'staff_id' => 'staff_id',
            'status' => 'status',
            'last_login_at' => 'last_login_at',
            'created_at' => 'created_at',
        ];

        $column = $allowed[$sortBy] ?? 'created_at';
        $query->orderBy($column, $sortDir)->orderBy('id', 'desc');
    }

    private function transformUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'staff_id' => $user->staff_id,
            'roles' => $user->roles->pluck('name')->values()->all(),
            'role_labels' => $user->roles->pluck('name')->join(', ') ?: 'No roles',
            'status' => $user->status ?? User::STATUS_ACTIVE,
            'status_label' => ucfirst($user->status ?? User::STATUS_ACTIVE),
            'is_locked' => $user->locked_at !== null,
            'password_status' => $user->passwordStatusLabel(),
            'must_change_password' => (bool) $user->must_change_password,
            'last_login_at' => $user->last_login_at?->toIso8601String(),
            'last_login_display' => $user->last_login_at?->format('M d, Y g:i A'),
            'created_at' => $user->created_at?->format('M d, Y'),
            'initials' => $this->initials($user->name),
        ];
    }

    private function getSummaryCards(): array
    {
        $total = User::count();
        $active = User::where('status', User::STATUS_ACTIVE)->whereNull('locked_at')->count();
        $inactive = User::where('status', User::STATUS_INACTIVE)->count();
        $suspended = User::where('status', User::STATUS_SUSPENDED)->count();
        $newThisMonth = User::whereMonth('created_at', now()->month)->whereYear('created_at', now()->year)->count();
        $locked = User::whereNotNull('locked_at')->count();
        $resetRequired = User::where('must_change_password', true)->count();
        $resetsThisMonth = ActivityLog::query()
            ->where('event_type', 'admin_password_reset')
            ->whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->count();
        $loggedInNow = DB::table('sessions')
            ->whereNotNull('user_id')
            ->where('last_activity', '>=', now()->subMinutes(30)->timestamp)
            ->distinct('user_id')
            ->count('user_id');

        $roleCounts = User::query()
            ->with('roles')
            ->get()
            ->flatMap(fn (User $user) => $user->roles->pluck('name'))
            ->countBy()
            ->sortDesc();

        $topRoles = $roleCounts->take(3);

        $cards = [
            ['title' => 'Total Users', 'value' => (string) $total, 'change' => 'All admin accounts', 'changeType' => 'neutral', 'icon' => 'Users', 'group' => 'users'],
            ['title' => 'Active Users', 'value' => (string) $active, 'change' => $total > 0 ? round(($active / $total) * 100, 1) . '% active' : '', 'changeType' => 'positive', 'icon' => 'CheckCircle', 'group' => 'users'],
            ['title' => 'Inactive Users', 'value' => (string) $inactive, 'change' => '', 'changeType' => 'neutral', 'icon' => 'XCircle', 'group' => 'users'],
            ['title' => 'New This Month', 'value' => (string) $newThisMonth, 'change' => now()->format('F Y'), 'changeType' => 'positive', 'icon' => 'Calendar', 'group' => 'users'],
            ['title' => 'Locked Accounts', 'value' => (string) $locked, 'change' => $suspended . ' suspended', 'changeType' => $locked > 0 ? 'negative' : 'neutral', 'icon' => 'ShieldX', 'group' => 'security'],
            ['title' => 'Password Reset Required', 'value' => (string) $resetRequired, 'change' => 'Must change on login', 'changeType' => $resetRequired > 0 ? 'negative' : 'neutral', 'icon' => 'Key', 'group' => 'security'],
            ['title' => 'Resets This Month', 'value' => (string) $resetsThisMonth, 'change' => 'Admin-initiated', 'changeType' => 'neutral', 'icon' => 'RefreshCw', 'group' => 'security'],
            ['title' => 'Logged In Now', 'value' => (string) $loggedInNow, 'change' => 'Active sessions (30 min)', 'changeType' => 'positive', 'icon' => 'Activity', 'group' => 'security'],
        ];

        $index = 0;
        foreach ($topRoles as $roleName => $count) {
            $cards[] = [
                'title' => $roleName,
                'value' => (string) $count,
                'change' => 'Users with role',
                'changeType' => 'neutral',
                'icon' => 'ShieldCheck',
                'group' => 'roles',
            ];
            $index++;
            if ($index >= 3) {
                break;
            }
        }

        if ($topRoles->isEmpty()) {
            $cards[] = ['title' => 'Assigned Roles', 'value' => '0', 'change' => 'No roles assigned yet', 'changeType' => 'neutral', 'icon' => 'ShieldCheck', 'group' => 'roles'];
        }

        return $cards;
    }

    private function currentFilters(Request $request): array
    {
        return $request->only([
            'search',
            'role',
            'status',
            'password_status',
            'login_status',
            'created_from',
            'created_to',
            'last_login_from',
            'last_login_to',
            'sort_by',
            'sort_dir',
            'per_page',
        ]);
    }

    private function initials(string $name): string
    {
        return collect(explode(' ', trim($name)))
            ->filter()
            ->take(2)
            ->map(fn (string $part) => strtoupper(substr($part, 0, 1)))
            ->join('');
    }
}
