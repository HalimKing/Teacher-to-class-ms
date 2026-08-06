<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AttendanceExplanation;
use App\Services\AttendanceExplanationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttendanceExplanationController extends Controller
{
    public function __construct(
        private AttendanceExplanationService $service,
    ) {}

    public function index(Request $request): Response
    {
        $query = AttendanceExplanation::query()
            ->with(['staff', 'reviewer', 'timetable'])
            ->latest('id');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($type = $request->get('type')) {
            $query->where('explanation_type', $type);
        }

        if ($search = $request->get('search')) {
            $query->whereHas('staff', function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('employee_id', 'like', "%{$search}%");
            });
        }

        return Inertia::render('admin/attendance-explanations/index', [
            'explanations' => $query->paginate(20)->withQueryString(),
            'filters' => $request->only(['status', 'type', 'search']),
            'reasonCategories' => AttendanceExplanation::REASON_CATEGORIES,
        ]);
    }

    public function show(AttendanceExplanation $attendanceExplanation): Response
    {
        $attendanceExplanation->load(['staff', 'reviewer', 'timetable.classRoom']);

        return Inertia::render('admin/attendance-explanations/show', [
            'explanation' => [
                ...$attendanceExplanation->toArray(),
                'reason_category_label' => $attendanceExplanation->reasonCategoryLabel(),
                'attendance_record' => $attendanceExplanation->attendanceRecord(),
                'document_url' => $attendanceExplanation->supporting_document_path
                    ? route('admin.attendance-explanations.document', $attendanceExplanation)
                    : null,
            ],
            'reasonCategories' => AttendanceExplanation::REASON_CATEGORIES,
        ]);
    }

    public function approve(Request $request, AttendanceExplanation $attendanceExplanation): RedirectResponse
    {
        $data = $request->validate([
            'admin_comments' => ['nullable', 'string', 'max:2000'],
            'update_attendance_status' => ['nullable', 'boolean'],
        ]);

        if ($attendanceExplanation->status !== AttendanceExplanation::STATUS_PENDING) {
            return back()->with('error', 'Only pending explanations can be approved.');
        }

        $this->service->approve(
            $attendanceExplanation,
            $request->user(),
            $data['admin_comments'] ?? null,
            $request->boolean('update_attendance_status', true),
        );

        return back()->with('success', 'Explanation approved.');
    }

    public function reject(Request $request, AttendanceExplanation $attendanceExplanation): RedirectResponse
    {
        $data = $request->validate([
            'admin_comments' => ['nullable', 'string', 'max:2000'],
        ]);

        if ($attendanceExplanation->status !== AttendanceExplanation::STATUS_PENDING) {
            return back()->with('error', 'Only pending explanations can be rejected.');
        }

        $this->service->reject(
            $attendanceExplanation,
            $request->user(),
            $data['admin_comments'] ?? null,
        );

        return back()->with('success', 'Explanation rejected.');
    }

    public function document(AttendanceExplanation $attendanceExplanation): StreamedResponse|\Illuminate\Http\Response
    {
        if (!$attendanceExplanation->supporting_document_path) {
            abort(404);
        }

        return response()->file(
            storage_path('app/public/' . $attendanceExplanation->supporting_document_path),
            [
                'Content-Disposition' => 'inline; filename="' . ($attendanceExplanation->supporting_document_name ?? 'document') . '"',
            ]
        );
    }
}
