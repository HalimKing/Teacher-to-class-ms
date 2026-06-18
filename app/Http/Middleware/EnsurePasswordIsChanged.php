<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePasswordIsChanged
{
    /**
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user('web');

        if (!$user instanceof User || !$user->must_change_password) {
            return $next($request);
        }

        if ($request->routeIs([
            'password.edit',
            'password.update',
            'logout',
        ])) {
            return $next($request);
        }

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'You must change your password before continuing.',
            ], 403);
        }

        return redirect()
            ->route('password.edit')
            ->with('error', 'You must change your password before continuing.');
    }
}
