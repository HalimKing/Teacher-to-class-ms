<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CsrfTokenController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        return response()->json([
            'token' => csrf_token(),
            'session_id' => $request->session()->getId(),
        ]);
    }
}
