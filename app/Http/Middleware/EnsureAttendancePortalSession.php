<?php

namespace App\Http\Middleware;

use App\Services\AttendancePortalService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureAttendancePortalSession
{
    public function __construct(
        private AttendancePortalService $portal,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! Auth::guard('teacher')->check()) {
            return redirect()->route('attendance.login');
        }

        if (! $this->portal->isActive($request) || $this->portal->isExpired($request)) {
            $this->portal->clear($request);
            Auth::guard('teacher')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            $message = 'Your attendance session expired. Please enter your Staff ID again.';

            if ($request->expectsJson() || $request->ajax()) {
                return response()->json([
                    'success' => false,
                    'message' => $message,
                ], 401);
            }

            return redirect()
                ->route('attendance.login')
                ->with('error', $message);
        }

        $this->portal->touch($request);

        return $next($request);
    }
}
