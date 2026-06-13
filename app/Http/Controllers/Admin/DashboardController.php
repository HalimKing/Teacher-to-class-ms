<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AdminDashboardService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function __construct(
        private AdminDashboardService $dashboardService
    ) {}

    public function index()
    {
        return Inertia::render('dashboard', $this->dashboardService->build());
    }

    public function getAttendanceData(Request $request)
    {
        $range = $request->input('range', '30days');

        return response()->json($this->dashboardService->attendanceTrend($range));
    }
}
