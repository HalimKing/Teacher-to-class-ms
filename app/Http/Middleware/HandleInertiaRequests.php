<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Inertia\Middleware;
use Tighten\Ziggy\Ziggy;
use App\Models\SystemSetting;

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

        $user = $request->user();

        return [
            ...parent::share($request),

            'name' => 'Teacher-to-Class MS', // Can be used in frontend for display or title

            'quote' => [
                'message' => trim($message),
                'author' => trim($author),
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
            ],

            'ziggy' => fn(): array => [
                ...(new Ziggy)->toArray(),
                'location' => $request->url(),
            ],

            'sidebarOpen' => ! $request->hasCookie('sidebar_state')
                || $request->cookie('sidebar_state') === 'true',

            'flash' => [
                'success' => fn() => $request->session()->get('success'),
                'error' => fn() => $request->session()->get('error'),
            ],

            // Expose system settings (grouped) to the frontend so UI can react to changes
            'system_settings' => fn() => SystemSetting::getGrouped(),
        ];
    }
}
