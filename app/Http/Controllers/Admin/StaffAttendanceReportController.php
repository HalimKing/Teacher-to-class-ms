<?php

namespace App\Http\Controllers\Admin;

use App\Exports\GenericArrayExport;
use App\Http\Controllers\Controller;
use App\Models\Teacher;
use App\Services\AdminStaffAttendanceReportService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StaffAttendanceReportController extends Controller
{
    public function __construct(
        private AdminStaffAttendanceReportService $reportService
    ) {}

    public function index()
    {
        return Inertia::render('admin/staff-attendance-reports/index', [
            'filterOptions' => $this->reportService->getFilterOptions(),
            'initialFilters' => [
                'start_date' => Carbon::now()->subMonth()->toDateString(),
                'end_date' => Carbon::now()->toDateString(),
            ],
        ]);
    }

    public function data(Request $request)
    {
        try {
            return response()->json([
                'success' => true,
                'data' => [
                    'summaryCards' => $this->reportService->getSummaryCards($request),
                    'records' => $this->reportService->paginateRecords($request),
                    'analytics' => $this->reportService->getAnalytics($request),
                ],
            ]);
        } catch (\Throwable $exception) {
            Log::error('Staff attendance report data error: ' . $exception->getMessage(), [
                'trace' => $exception->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to load staff attendance report data.',
            ], 500);
        }
    }

    public function show(Teacher $teacher)
    {
        abort_unless($teacher->isAdministrator(), 404);

        $teacher->load(['department', 'faculty']);

        return Inertia::render('admin/staff-attendance-reports/show', [
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

    public function showData(Teacher $teacher, Request $request)
    {
        abort_unless($teacher->isAdministrator(), 404);

        try {
            return response()->json([
                'success' => true,
                'data' => $this->reportService->getIndividualReport($teacher, $request),
            ]);
        } catch (\Throwable $exception) {
            Log::error('Staff individual report error: ' . $exception->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to load individual staff attendance report.',
            ], 500);
        }
    }

    public function export(Request $request)
    {
        $format = strtolower((string) $request->get('format', 'xlsx'));
        $records = $this->reportService->getRecords($request);
        $rows = $this->reportService->exportRows($records);
        $filenameBase = 'administrator_attendance_' . now()->format('Ymd_His');

        if ($format === 'csv') {
            return $this->exportCsv($rows, "{$filenameBase}.csv");
        }

        if ($format === 'pdf') {
            return $this->exportPdf($rows, $request, "{$filenameBase}.pdf");
        }

        if ($format === 'print') {
            return view('admin.staff-attendance-report-print', [
                'rows' => $rows,
                'filters' => $request->all(),
                'generatedAt' => now()->format('Y-m-d H:i:s'),
            ]);
        }

        return Excel::download(new GenericArrayExport($rows), "{$filenameBase}.xlsx");
    }

    private function exportCsv(array $rows, string $filename): StreamedResponse
    {
        return response()->streamDownload(function () use ($rows) {
            $handle = fopen('php://output', 'w');

            if (!empty($rows)) {
                fputcsv($handle, array_keys($rows[0]));
                foreach ($rows as $row) {
                    fputcsv($handle, $row);
                }
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    private function exportPdf(array $rows, Request $request, string $filename)
    {
        if (!class_exists(\Barryvdh\DomPDF\Facade\Pdf::class)) {
            abort(500, 'PDF export requires the barryvdh/laravel-dompdf package. Run: composer require barryvdh/laravel-dompdf');
        }

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('admin.staff-attendance-report-pdf', [
            'rows' => $rows,
            'filters' => $request->all(),
            'generatedAt' => now()->format('Y-m-d H:i:s'),
        ]);

        return $pdf->download($filename);
    }
}
