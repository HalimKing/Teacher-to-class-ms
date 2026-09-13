<?php

namespace App\Support;

use App\Models\User;
use App\Services\AttendancePortalService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthenticatedHome
{
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
}
