<?php

use App\Http\Middleware\AuthenticateAny;
use App\Http\Middleware\EnsureAttendancePortalSession;
use App\Http\Middleware\EnsureTeacherStaffType;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\PreventHttpCaching;
use App\Http\Middleware\RestrictAttendancePortalAccess;
use App\Services\ActivityLogService;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Support\Facades\Log;
use Spatie\Permission\Exceptions\UnauthorizedException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Do NOT exclude XSRF-TOKEN: Inertia/Axios send it as X-XSRF-TOKEN and
        // Laravel must decrypt that header. Keep CSRF sync via shared csrf_token + meta.
        $middleware->encryptCookies(except: [
            'appearance',
            'sidebar_state',
        ]);

         $middleware->alias([
            'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
            'auth.any' => AuthenticateAny::class,
            'teacher.staff_type' => EnsureTeacherStaffType::class,
            'attendance.portal' => EnsureAttendancePortalSession::class,
            'attendance.portal.restrict' => RestrictAttendancePortalAccess::class,
            'password.changed' => \App\Http\Middleware\EnsurePasswordIsChanged::class,
        ]);

        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            PreventHttpCaching::class,
        ]);

        $middleware->trustProxies(
            at: '*',
            headers: Request::HEADER_X_FORWARDED_FOR |
                Request::HEADER_X_FORWARDED_HOST |
                Request::HEADER_X_FORWARDED_PORT |
                Request::HEADER_X_FORWARDED_PROTO |
                Request::HEADER_X_FORWARDED_PREFIX |
                Request::HEADER_X_FORWARDED_AWS_ELB,
        );
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (UnauthorizedException $exception, \Illuminate\Http\Request $request) {
            if ($request->user()) {
                app(ActivityLogService::class)->logSecurityEvent(
                    eventType: 'permission_denied',
                    description: 'Permission denied while accessing ' . $request->path(),
                    metadata: [
                        'message' => $exception->getMessage(),
                    ],
                );
            }

            return null;
        });

        $exceptions->render(function (TokenMismatchException $exception, Request $request) {
            if (filter_var(env('CSRF_DEBUG', false), FILTER_VALIDATE_BOOLEAN)) {
                Log::warning('csrf.token_mismatch', [
                    'path' => $request->path(),
                    'method' => $request->method(),
                    'session_id' => $request->hasSession() ? $request->session()->getId() : null,
                    'session_token' => $request->hasSession() ? $request->session()->token() : null,
                    'header_token' => $request->header('X-CSRF-TOKEN'),
                    'input_token' => $request->input('_token'),
                    'x_xsrf_token' => $request->header('X-XSRF-TOKEN'),
                    'user_id' => $request->user()?->id,
                    'teacher_id' => auth('teacher')->id(),
                    'referer' => $request->headers->get('referer'),
                    'user_agent' => $request->userAgent(),
                    'ajax' => $request->ajax(),
                    'inertia' => (bool) $request->header('X-Inertia'),
                ]);
            }

            return null;
        });
    })->create();
