<?php

namespace App\Http\Controllers;

use App\Exports\GenericArrayExport;
use App\Models\Teacher;
use App\Models\TeacherAttendance;
use App\Services\LecturerAttendanceReportService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TeacherAttendanceReportController extends Controller
{
    public function __construct(
        private LecturerAttendanceReportService $reportService,
    ) {}

    public function index()
    {
        $teacher = auth('teacher')->user();

        return Inertia::render('teacher/attendance-report', [
            'filterOptions' => $this->reportService->getFilterOptions($teacher),
            'initialFilters' => [
                'start_date' => Carbon::now()->subMonth()->toDateString(),
                'end_date' => Carbon::now()->toDateString(),
            ],
            'teacher' => [
                'name' => trim("{$teacher->title} {$teacher->first_name} {$teacher->last_name}"),
                'employee_id' => $teacher->employee_id,
            ],
        ]);
    }

    public function getReportData(Request $request)
    {
        try {
            $teacher = auth('teacher')->user();

            return response()->json([
                'success' => true,
                'data' => $this->reportService->getDashboardData($teacher, $request),
            ]);
        } catch (\Throwable $exception) {
            Log::error('Lecturer attendance report data error: ' . $exception->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to load attendance analytics.',
            ], 500);
        }
    }

    public function records(Request $request)
    {
        try {
            $teacher = auth('teacher')->user();

            return response()->json([
                'success' => true,
                'data' => $this->reportService->paginateRecords($teacher, $request),
            ]);
        } catch (\Throwable $exception) {
            Log::error('Lecturer attendance records error: ' . $exception->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to load attendance records.',
            ], 500);
        }
    }

    public function showRecord(TeacherAttendance $attendance, Request $request)
    {
        $teacher = auth('teacher')->user();

        if ($attendance->teacher_id !== $teacher->id) {
            abort(404);
        }

        try {
            return response()->json([
                'success' => true,
                'data' => $this->reportService->getRecordDetail($teacher, $attendance),
            ]);
        } catch (\Throwable $exception) {
            Log::error('Lecturer attendance record detail error: ' . $exception->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to load session details.',
            ], 500);
        }
    }

    public function export(Request $request)
    {
        $teacher = auth('teacher')->user();
        $format = strtolower((string) $request->get('format', 'xlsx'));
        $rows = $this->reportService->getExportRows($teacher, $request);
        $filenameBase = 'my_attendance_' . now()->format('Ymd_His');

        if ($format === 'csv') {
            return $this->exportCsv($rows, "{$filenameBase}.csv");
        }

        if ($format === 'pdf') {
            return $this->exportPdf($rows, $request, "{$filenameBase}.pdf", $teacher);
        }

        if ($format === 'print') {
            return view('teacher.attendance-report-print', [
                'rows' => $rows,
                'filters' => $request->all(),
                'generatedAt' => now()->format('Y-m-d H:i:s'),
                'teacher' => $teacher,
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
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    private function exportPdf(array $rows, Request $request, string $filename, Teacher $teacher)
    {
        if (!class_exists(\Barryvdh\DomPDF\Facade\Pdf::class)) {
            abort(500, 'PDF export requires the barryvdh/laravel-dompdf package.');
        }

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('teacher.attendance-report-pdf', [
            'rows' => $rows,
            'filters' => $request->all(),
            'generatedAt' => now()->format('Y-m-d H:i:s'),
            'teacher' => $teacher,
        ]);

        return $pdf->download($filename);
    }
}
