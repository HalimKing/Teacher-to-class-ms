<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Services\AdminStaffAttendanceReportService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StaffAttendanceReportController extends Controller
{
    public function __construct(
        private AdminStaffAttendanceReportService $reportService
    ) {}

    public function index(): Response
    {
        $teacher = auth('teacher')->user();
        $teacher->load(['department', 'faculty']);

        return Inertia::render('teacher/staff-attendance-report', [
            'staff' => [
                'id' => $teacher->id,
                'name' => trim("{$teacher->title} {$teacher->first_name} {$teacher->last_name}"),
                'email' => $teacher->email,
                'employee_id' => $teacher->employee_id,
                'department' => $teacher->department?->name,
                'faculty' => $teacher->faculty?->name,
                'face_enrollment_status' => $teacher->faceEnrollmentStatus(),
            ],
            'initialFilters' => [
                'start_date' => Carbon::now()->subMonths(3)->toDateString(),
                'end_date' => Carbon::now()->toDateString(),
            ],
        ]);
    }

    public function data(Request $request)
    {
        $teacher = auth('teacher')->user();
        abort_unless($teacher->isAdministrator(), 403);

        try {
            return response()->json([
                'success' => true,
                'data' => $this->reportService->getIndividualReport($teacher, $request),
            ]);
        } catch (\Throwable $exception) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to load attendance report.',
            ], 500);
        }
    }
}
