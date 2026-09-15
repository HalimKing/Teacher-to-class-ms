<?php

namespace App\Support;

use App\Models\User;
use App\Services\AttendancePortalService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthenticatedHome
{
    /**
     * @var list<string>
     */
    private const BLOCKED_PATH_PREFIXES = [
        '/login',
        '/logout',
        '/register',
        '/forgot-password',
        '/reset-password',
        '/confirm-password',
        '/email/verify',
        '/attendance',
        '/up',
    ];

    /**
     * Destination for an already-authenticated session.
     *
     * Uses the active guard (and attendance-portal session) rather than a
     * hardcoded path so refreshes and direct visits keep the user in-app.
     */
    public static function path(?Request $request = null): string
    {
        $request ??= request();

        if (Auth::guard('web')->check()) {
            $user = Auth::guard('web')->user();

            if ($user instanceof User && $user->must_change_password) {
                return route('password.edit', absolute: false);
            }

            return route('admin.dashboard', absolute: false);
        }

        if (Auth::guard('teacher')->check()) {
            $portal = app(AttendancePortalService::class);

            if ($portal->isActive($request) && ! $portal->isExpired($request)) {
                return route('attendance.portal', absolute: false);
            }

            return route('teacher.dashboard', absolute: false);
        }

        return route('login', absolute: false);
    }

    /**
     * Post-login destination: the originally requested page when it is safe
     * and reachable for the signed-in guard, otherwise the default home.
     */
    public static function afterLogin(Request $request): string
    {
        $default = self::path($request);

        if (Auth::guard('web')->check()) {
            $user = Auth::guard('web')->user();

            if ($user instanceof User && $user->must_change_password) {
                return $default;
            }
        }

        $intended = self::safeIntendedPath($request);

        if ($intended === null || ! self::isAllowedForAuthenticatedUser($intended)) {
            return $default;
        }

        return $intended;
    }

    private static function safeIntendedPath(Request $request): ?string
    {
        $intended = $request->session()->pull('url.intended');

        if (! is_string($intended)) {
            return null;
        }

        $intended = trim($intended);

        if ($intended === '') {
            return null;
        }

        if (str_starts_with($intended, '/') && ! str_starts_with($intended, '//')) {
            $pathWithQuery = $intended;
        } else {
            $parts = parse_url($intended);

            if (! is_array($parts) || empty($parts['host'])) {
                return null;
            }

            $scheme = strtolower((string) ($parts['scheme'] ?? ''));
            if (! in_array($scheme, ['http', 'https'], true)) {
                return null;
            }

            $allowedHosts = array_values(array_filter([
                strtolower($request->getHost()),
                strtolower((string) parse_url((string) config('app.url'), PHP_URL_HOST)),
            ]));

            if (! in_array(strtolower($parts['host']), $allowedHosts, true)) {
                return null;
            }

            $pathWithQuery = $parts['path'] ?? '/';
            if (! empty($parts['query'])) {
                $pathWithQuery .= '?'.$parts['query'];
            }
        }

        $path = parse_url($pathWithQuery, PHP_URL_PATH) ?: '/';

        if (! str_starts_with($path, '/') || str_contains($path, '..')) {
            return null;
        }

        foreach (self::BLOCKED_PATH_PREFIXES as $prefix) {
            if ($path === $prefix || str_starts_with($path, $prefix.'/')) {
                return null;
            }
        }

        return $pathWithQuery;
    }

    private static function isAllowedForAuthenticatedUser(string $intended): bool
    {
        $path = parse_url($intended, PHP_URL_PATH) ?: '/';

        if (Auth::guard('web')->check()) {
            return str_starts_with($path, '/admin')
                || str_starts_with($path, '/settings')
                || $path === '/search';
        }

        if (Auth::guard('teacher')->check()) {
            return str_starts_with($path, '/teacher')
                || str_starts_with($path, '/settings')
                || $path === '/search';
        }

        return false;
    }
}
