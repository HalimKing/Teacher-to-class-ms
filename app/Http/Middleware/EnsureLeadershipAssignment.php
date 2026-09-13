<?php

namespace App\Http\Middleware;

use App\Models\Teacher;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureLeadershipAssignment
{
    public function handle(Request $request, Closure $next): Response
    {
        $teacher = Auth::guard('teacher')->user();

        if (! $teacher instanceof Teacher || ! $teacher->hasLeadershipAssignment()) {
            abort(403, 'This action requires a Director/Dean or Head of Department assignment.');
        }

        return $next($request);
    }
}
