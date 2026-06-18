<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Inertia\Middleware;
use Tighten\Ziggy\Ziggy;
use App\Models\SystemSetting;
use App\Services\AttendancePortalService;
use App\Support\LecturerNotificationPayload;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

        $user = $request->user('teacher') ?? $request->user('web') ?? $request->user();

        return [
            ...parent::share($request),

            'name' => 'Teacher-to-Class MS', // Can be used in frontend for display or title

            'quote' => [
                'message' => trim($message),
                'author' => trim($author),
            ],

            'flash' => [
                'success' => fn() => $request->session()->get('success'),
                'error' => fn() => $request->session()->get('error'),
                'generatedPassword' => fn() => $request->session()->get('generatedPassword'),
            ],

            'auth' => [
                'user' => $user,

                // Only admins (web guard) have Spatie permissions
                'permissions' => auth()->guard('web')->check()
                    ? $user->getAllPermissions()->pluck('name')
                    : [],

                // Optional: expose which guard is logged in
                'guard' => auth()->guard('web')->check()
                    ? 'admin'
                    : (auth()->guard('teacher')->check() ? 'teacher' : null),

                'mustChangePassword' => auth()->guard('web')->check() && $user instanceof \App\Models\User
                    ? (bool) $user->must_change_password
                    : false,
            ],

            // For teachers: recent unread notifications (e.g. session reminders)
            'unreadNotifications' => fn() => auth()->guard('teacher')->check() && $user
                ? $user->unreadNotifications()->latest()->take(10)->get()->map(fn ($n) => [
                    'id' => $n->id,
                    'type' => $n->type,
                    'data' => LecturerNotificationPayload::normalize($n->data ?? []),
                    'read_at' => $n->read_at?->toIso8601String(),
                    'created_at' => $n->created_at->toIso8601String(),
                ])->toArray()
                : [],
            'unreadNotificationsCount' => fn() => auth()->guard('teacher')->check() && $user
                ? $user->unreadNotifications()->count()
                : 0,

            'ziggy' => fn (): array => rescue(
                fn () => [
                    ...(new Ziggy)->toArray(),
                    'location' => $request->url(),
                ],
                fn () => ['location' => $request->url()],
                report: false,
            ),

            'sidebarOpen' => ! $request->hasCookie('sidebar_state')
                || $request->cookie('sidebar_state') === 'true',

            // Expose system settings (grouped) to the frontend so UI can react to changes
            'system_settings' => fn () => rescue(
                fn () => SystemSetting::getGrouped(),
                fn () => [],
                report: false,
            ),

            'attendancePortal' => fn () => app(AttendancePortalService::class)->shareData($request),
        ];
    }
}
