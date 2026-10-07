<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Teacher;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class StaffActivityService
{
    public const RECENT_LIMIT = 8;

    /**
     * @return list<array{value: string, label: string}>
     */
    public function filterOptions(): array
    {
        $labels = $this->moduleLabels();

        return [
            'categories' => collect(ActivityLogService::categories())
                ->map(fn (string $value) => [
                    'value' => $value,
                    'label' => $labels[$value] ?? ucwords(str_replace('_', ' ', $value)),
                ])
                ->values()
                ->all(),
            'statuses' => [
                ['value' => ActivityLogService::STATUS_SUCCESS, 'label' => 'Successful'],
                ['value' => ActivityLogService::STATUS_FAILED, 'label' => 'Failed'],
            ],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function recentFor(Teacher $teacher, int $limit = self::RECENT_LIMIT): array
    {
        return ActivityLog::query()
            ->forTeacher($teacher)
            ->latest('created_at')
            ->latest('id')
            ->limit(max(5, min($limit, 10)))
            ->get()
            ->map(fn (ActivityLog $log) => $this->present($log, detailed: false))
            ->values()
            ->all();
    }

    public function paginateFor(Teacher $teacher, Request $request): LengthAwarePaginator
    {
        $perPage = min(max((int) $request->integer('per_page', 15), 5), 50);

        return $this->queryFor($teacher, $request)
            ->latest('created_at')
            ->latest('id')
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn (ActivityLog $log) => $this->present($log, detailed: true));
    }

    public function queryFor(Teacher $teacher, ?Request $request = null): Builder
    {
        $query = ActivityLog::query()->forTeacher($teacher);

        if (! $request) {
            return $query;
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->string('search'));
            $query->where(function (Builder $searchQuery) use ($search) {
                $searchQuery->where('description', 'like', "%{$search}%")
                    ->orWhere('event_type', 'like', "%{$search}%")
                    ->orWhere('event_category', 'like', "%{$search}%")
                    ->orWhere('ip_address', 'like', "%{$search}%");
            });
        }

        if ($request->filled('category') && $request->string('category')->toString() !== 'all') {
            $query->where('event_category', $request->string('category')->toString());
        }

        if ($request->filled('status') && $request->string('status')->toString() !== 'all') {
            $query->where('status', $request->string('status')->toString());
        }

        if ($request->filled('start_date')) {
            $query->whereDate('created_at', '>=', Carbon::parse($request->string('start_date')->toString())->toDateString());
        }

        if ($request->filled('end_date')) {
            $query->whereDate('created_at', '<=', Carbon::parse($request->string('end_date')->toString())->toDateString());
        }

        return $query;
    }

    /**
     * @return array<string, mixed>
     */
    public function present(ActivityLog $log, bool $detailed = false): array
    {
        $catalog = $this->catalog()[$log->event_type] ?? null;
        $moduleLabels = $this->moduleLabels();
        $metadata = $this->sanitizeMetadata($log->metadata ?? []);
        $title = $catalog['title'] ?? $this->humanizeEventType($log->event_type);
        $description = $this->staffDescription($log, $catalog['title'] ?? null);

        $item = [
            'id' => $log->id,
            'action' => $log->event_type,
            'title' => $title,
            'description' => $description,
            'module' => $log->event_category,
            'module_label' => $moduleLabels[$log->event_category] ?? ucwords(str_replace('_', ' ', (string) $log->event_category)),
            'icon' => $catalog['icon'] ?? $this->iconForCategory($log->event_category),
            'status' => $log->status,
            'resource' => $this->resourceFromMetadata($metadata),
            'created_at' => $log->created_at?->toIso8601String(),
            'created_at_display' => $log->created_at?->timezone(config('app.timezone'))->format('M j, Y g:i A'),
            'relative_time' => $log->created_at?->diffForHumans(),
        ];

        if ($detailed) {
            $item['ip_address'] = $log->ip_address;
            $item['browser'] = $this->parseBrowser($log->user_agent);
            $item['device'] = $this->parseDevice($log->user_agent);
        }

        return $item;
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @return array{type: string, id: int|string|null, label: string}|null
     */
    private function resourceFromMetadata(array $metadata): ?array
    {
        $label = $metadata['resource_label']
            ?? $metadata['ticket_number']
            ?? $metadata['subject']
            ?? $metadata['title']
            ?? $metadata['course_name']
            ?? $metadata['staff_name']
            ?? null;

        if (! is_string($label) || trim($label) === '') {
            return null;
        }

        $id = $metadata['resource_id']
            ?? $metadata['ticket_id']
            ?? $metadata['attendance_id']
            ?? $metadata['timetable_id']
            ?? $metadata['communication_id']
            ?? $metadata['reminder_id']
            ?? null;

        return [
            'type' => (string) ($metadata['resource_type'] ?? $metadata['event_category'] ?? 'record'),
            'id' => is_scalar($id) ? $id : null,
            'label' => trim($label),
        ];
    }

    private function staffDescription(ActivityLog $log, ?string $mappedTitle): string
    {
        $description = trim((string) $log->description);

        if ($description === '' || $description === $mappedTitle) {
            return $mappedTitle ?: $this->humanizeEventType($log->event_type);
        }

        return $description;
    }

    private function humanizeEventType(string $eventType): string
    {
        return ucfirst(str_replace('_', ' ', $eventType));
    }

    /**
     * @return array<string, array{title: string, icon: string}>
     */
    private function catalog(): array
    {
        return [
            'login' => ['title' => 'Signed in', 'icon' => 'login'],
            'logout' => ['title' => 'Signed out', 'icon' => 'logout'],
            'failed_login' => ['title' => 'Sign-in failed', 'icon' => 'login'],
            'attendance_portal_login' => ['title' => 'Signed in to the attendance portal', 'icon' => 'login'],
            'attendance_portal_logout' => ['title' => 'Signed out of the attendance portal', 'icon' => 'logout'],
            'attendance_check_in' => ['title' => 'Checked in for attendance', 'icon' => 'check-in'],
            'attendance_check_out' => ['title' => 'Checked out from attendance', 'icon' => 'check-out'],
            'attendance_attempt_failed' => ['title' => 'Attendance attempt failed', 'icon' => 'warning'],
            'face_verification_success' => ['title' => 'Face verification succeeded', 'icon' => 'shield'],
            'face_verification_failed' => ['title' => 'Face verification failed', 'icon' => 'warning'],
            'geolocation_verification_failed' => ['title' => 'Location verification failed', 'icon' => 'location'],
            'self_reported_absence_submitted' => ['title' => 'Submitted an absence request', 'icon' => 'absence'],
            'self_reported_absence_replied' => ['title' => 'Replied to an absence request', 'icon' => 'absence'],
            'attendance_explanation_submitted' => ['title' => 'Submitted an attendance explanation', 'icon' => 'explanation'],
            'auto_absence_recorded' => ['title' => 'Attendance marked absent automatically', 'icon' => 'absence'],
            'venue_change_request_submitted' => ['title' => 'Submitted a venue change request', 'icon' => 'location'],
            'venue_change_request_cancelled' => ['title' => 'Cancelled a venue change request', 'icon' => 'location'],
            'venue_change_request_approver_approved' => ['title' => 'Approved a venue change request', 'icon' => 'approve'],
            'venue_change_request_approver_rejected' => ['title' => 'Rejected a venue change request', 'icon' => 'reject'],
            'venue_change_request_approved' => ['title' => 'Approved a venue change request', 'icon' => 'approve'],
            'venue_change_request_rejected' => ['title' => 'Rejected a venue change request', 'icon' => 'reject'],
            'help_desk_ticket_created' => ['title' => 'Submitted a help desk ticket', 'icon' => 'help'],
            'help_desk_ticket_commented' => ['title' => 'Replied to a help desk ticket', 'icon' => 'help'],
            'help_desk_ticket_closed' => ['title' => 'Closed a help desk ticket', 'icon' => 'help'],
            'help_desk_attachment_downloaded' => ['title' => 'Downloaded a help desk document', 'icon' => 'document'],
            'message_sent' => ['title' => 'Sent a message', 'icon' => 'message'],
            'message_replied' => ['title' => 'Replied to a message', 'icon' => 'message'],
            'message_draft_saved' => ['title' => 'Saved a message draft', 'icon' => 'message'],
            'password_changed' => ['title' => 'Changed account password', 'icon' => 'password'],
            'reminder_created' => ['title' => 'Created a reminder', 'icon' => 'reminder'],
            'reminder_updated' => ['title' => 'Updated a reminder', 'icon' => 'reminder'],
            'reminder_deleted' => ['title' => 'Deleted a reminder', 'icon' => 'reminder'],
            'session_rescheduled' => ['title' => 'Submitted a reschedule request', 'icon' => 'calendar'],
            'unit_staff_updated' => ['title' => 'Updated unit staff details', 'icon' => 'users'],
        ];
    }

    /**
     * @return array<string, string>
     */
    private function moduleLabels(): array
    {
        return [
            ActivityLogService::CATEGORY_AUTHENTICATION => 'Sign-in',
            ActivityLogService::CATEGORY_ATTENDANCE => 'Attendance',
            ActivityLogService::CATEGORY_COMMUNICATION => 'Messages',
            ActivityLogService::CATEGORY_HELP_DESK => 'Help Desk',
            ActivityLogService::CATEGORY_ACCOUNT => 'Account',
            ActivityLogService::CATEGORY_USER_MANAGEMENT => 'Staff management',
            ActivityLogService::CATEGORY_TIMETABLE => 'Timetable',
            ActivityLogService::CATEGORY_SYSTEM_SETTINGS => 'Settings',
            ActivityLogService::CATEGORY_SECURITY => 'Security',
        ];
    }

    private function iconForCategory(?string $category): string
    {
        return match ($category) {
            ActivityLogService::CATEGORY_AUTHENTICATION => 'login',
            ActivityLogService::CATEGORY_ATTENDANCE => 'check-in',
            ActivityLogService::CATEGORY_COMMUNICATION => 'message',
            ActivityLogService::CATEGORY_HELP_DESK => 'help',
            ActivityLogService::CATEGORY_ACCOUNT => 'password',
            ActivityLogService::CATEGORY_TIMETABLE => 'calendar',
            ActivityLogService::CATEGORY_USER_MANAGEMENT => 'users',
            ActivityLogService::CATEGORY_SECURITY => 'shield',
            default => 'activity',
        };
    }

    /**
     * @param  array<string, mixed>|null  $metadata
     * @return array<string, mixed>
     */
    private function sanitizeMetadata(?array $metadata): array
    {
        if (! is_array($metadata)) {
            return [];
        }

        $sensitive = [
            'password',
            'current_password',
            'token',
            'verification_token',
            'face_verification_token',
            'face_descriptor',
            'descriptor',
            'secret',
            'hash',
            'authorization',
            'remember_token',
            'api_key',
        ];

        return Collection::make($metadata)
            ->reject(function ($value, $key) use ($sensitive) {
                $normalized = strtolower((string) $key);

                foreach ($sensitive as $needle) {
                    if (str_contains($normalized, $needle)) {
                        return true;
                    }
                }

                return false;
            })
            ->all();
    }

    private function parseBrowser(?string $userAgent): string
    {
        if (! $userAgent) {
            return 'Unknown';
        }

        return match (true) {
            str_contains($userAgent, 'Edg/') => 'Microsoft Edge',
            str_contains($userAgent, 'Chrome/') => 'Chrome',
            str_contains($userAgent, 'Firefox/') => 'Firefox',
            str_contains($userAgent, 'Safari/') && ! str_contains($userAgent, 'Chrome/') => 'Safari',
            default => 'Other',
        };
    }

    private function parseDevice(?string $userAgent): string
    {
        if (! $userAgent) {
            return 'Unknown';
        }

        return match (true) {
            str_contains($userAgent, 'Mobile') => 'Mobile',
            str_contains($userAgent, 'Tablet') || str_contains($userAgent, 'iPad') => 'Tablet',
            default => 'Desktop',
        };
    }
}
