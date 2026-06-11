<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTeacherStaffType
{
    /**
     * Restrict teacher-guard routes to one or more staff types.
     */
    public function handle(Request $request, Closure $next, string ...$staffTypes): Response
    {
        $teacher = $request->user('teacher');

        if (!$teacher || !in_array($teacher->staff_type, $staffTypes, true)) {
            abort(403, 'This page is not available for your staff type.');
        }

        return $next($request);
    }
}
