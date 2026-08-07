<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CsrfTokenController extends Controller
{
    /**
     * Return the current session CSRF token for SPA fetch clients.
     *
     * Used after idle face-capture flows and on 419 recovery. Must never be
     * CDN/browser cached — a stale token immediately causes TokenMismatchException.
     */
    public function __invoke(Request $request): JsonResponse
    {
        // Ensure the session is started so csrf_token() matches this browser.
        $request->session()->start();

        return response()
            ->json([
                'token' => csrf_token(),
                'session_id' => $request->session()->getId(),
            ])
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            ->header('Pragma', 'no-cache')
            ->header('Expires', '0');
    }
}
