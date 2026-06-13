<?php

namespace App\Http\Controllers\Admin;

use App\Exports\GenericArrayExport;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Services\ActivityLogService;
use App\Services\SystemLogService;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SystemLogController extends Controller
{
    public function __construct(
        private SystemLogService $systemLogService,
        private ActivityLogService $activityLogService,
    ) {}

    public function index()
    {
        return Inertia::render('admin/system-logs/index', [
            'filterOptions' => $this->systemLogService->getFilterOptions(),
            'initialFilters' => [
                'start_date' => Carbon::now()->subDays(7)->toDateString(),
                'end_date' => Carbon::now()->toDateString(),
            ],
            'logRetentionDays' => max(1, (int) \App\Models\SystemSetting::getValue('log_retention_days', 90)),
        ]);
    }

    public function data(Request $request)
    {
        try {
            return response()->json([
                'success' => true,
                'data' => [
                    'summaryCards' => $this->systemLogService->getSummaryCards($request),
                    'securityHighlights' => $this->systemLogService->getSecurityHighlights($request),
                    'records' => $this->systemLogService->paginateLogs($request),
                ],
            ]);
        } catch (\Throwable $exception) {
            Log::error('System logs data error: ' . $exception->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to load system logs.',
            ], 500);
        }
    }

    public function show(ActivityLog $activityLog)
    {
        try {
            return response()->json([
                'success' => true,
                'data' => $this->systemLogService->getLog($activityLog),
            ]);
        } catch (\Throwable $exception) {
            Log::error('System log detail error: ' . $exception->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to load log details.',
            ], 500);
        }
    }

    public function export(Request $request)
    {
        $format = strtolower((string) $request->get('format', 'xlsx'));
        $records = $this->systemLogService->getRecords($request);
        $rows = $this->systemLogService->exportRows($records);
        $filenameBase = 'system_activity_logs_' . now()->format('Ymd_His');

        $this->activityLogService->log(
            eventType: 'logs_exported',
            category: ActivityLogService::CATEGORY_SECURITY,
            description: 'System logs exported (' . strtoupper($format) . ')',
            metadata: ['format' => $format, 'count' => count($rows)],
        );

        if ($format === 'csv') {
            return $this->exportCsv($rows, "{$filenameBase}.csv");
        }

        if ($format === 'pdf') {
            return $this->exportPdf($rows, $request, "{$filenameBase}.pdf");
        }

        return Excel::download(new GenericArrayExport($rows), "{$filenameBase}.xlsx");
    }

    public function prune(Request $request)
    {
        $deleted = $this->systemLogService->pruneExpiredLogs();

        $this->activityLogService->log(
            eventType: 'logs_pruned',
            category: ActivityLogService::CATEGORY_SECURITY,
            description: "Pruned {$deleted} expired activity log records",
            metadata: ['deleted_count' => $deleted],
        );

        return back()->with('success', "Removed {$deleted} expired log records.");
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
        $pdf = Pdf::loadView('admin.system-logs-export-pdf', [
            'rows' => $rows,
            'filters' => $request->all(),
            'generatedAt' => now()->format('Y-m-d H:i:s'),
        ]);

        return $pdf->download($filename);
    }
}
