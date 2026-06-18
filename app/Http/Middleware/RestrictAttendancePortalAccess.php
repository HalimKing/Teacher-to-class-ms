<?php

namespace App\Http\Middleware;

use App\Services\AttendancePortalService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class RestrictAttendancePortalAccess
{
    public function __construct(
        private AttendancePortalService $portal,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! $this->portal->isActive($request)) {
            return $next($request);
        }

        if ($this->portal->isExpired($request)) {
            $this->portal->clear($request);
            Auth::guard('teacher')->logout();

            if ($request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Your attendance session expired. Please sign in again.',
                ], 401);
            }

            return redirect()
                ->route('attendance.login')
                ->with('error', 'Your attendance session expired. Please enter your Staff ID again.');
        }

        $this->portal->touch($request);

        if ($this->portal->allowedPath($request)) {
            return $next($request);
        }

        if ($request->expectsJson()) {
            return response()->json([
                'success' => false,
                'message' => 'This action is not available in the attendance portal.',
            ], 403);
        }

        return redirect()->route('attendance.portal');
    }
}
