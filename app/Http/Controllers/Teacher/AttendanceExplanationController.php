<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\AttendanceExplanation;
use App\Models\StaffAttendance;
use App\Models\TeacherAttendance;
use App\Services\AttendanceExplanationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AttendanceExplanationController extends Controller
{
    public function __construct(
        private AttendanceExplanationService $service,
    ) {}

    public function index(): Response
    {
        $staff = auth('teacher')->user();

        $explanations = AttendanceExplanation::query()
            ->with(['reviewer', 'timetable'])
            ->where('staff_id', $staff->id)
            ->latest('id')
            ->paginate(15);

        $eligible = $this->eligibleRecords($staff->id);

        return Inertia::render('teacher/attendance-explanations', [
            'explanations' => $explanations,
            'eligibleRecords' => $eligible,
            'reasonCategories' => AttendanceExplanation::REASON_CATEGORIES,
        ]);
    }

    public function store(Request $request): JsonResponse|\Illuminate\Http\RedirectResponse
    {
        $staff = auth('teacher')->user();

        $data = $request->validate([
            'attendance_type' => ['required', Rule::in([
                AttendanceExplanation::ATTENDANCE_STAFF,
                AttendanceExplanation::ATTENDANCE_TEACHER,
            ])],
            'attendance_id' => ['required', 'integer'],
            'timetable_id' => ['nullable', 'exists:time_tables,id'],
            'attendance_date' => ['required', 'date'],
            'explanation_type' => ['required', Rule::in([
                AttendanceExplanation::TYPE_ABSENCE,
                AttendanceExplanation::TYPE_EARLY_DEPARTURE,
            ])],
            'reason_category' => ['required', Rule::in(array_keys(AttendanceExplanation::REASON_CATEGORIES))],
            'explanation' => ['required', 'string', 'max:5000'],
            'supporting_document' => ['nullable', 'file', 'max:5120', 'mimes:pdf,jpg,jpeg,png,doc,docx'],
        ]);

        $this->assertOwnsAttendance($staff->id, $data['attendance_type'], (int) $data['attendance_id']);

        try {
            $explanation = $this->service->submit(
                $staff,
                $data,
                $request->file('supporting_document'),
            );
        } catch (\InvalidArgumentException $e) {
            if ($request->wantsJson()) {
                return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
            }

            return back()->with('error', $e->getMessage());
        }

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'Explanation submitted for review.',
                'data' => $explanation,
            ]);
        }

        return back()->with('success', 'Explanation submitted for review.');
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function eligibleRecords(int $staffId): array
    {
        $existing = AttendanceExplanation::query()
            ->where('staff_id', $staffId)
            ->whereIn('status', [AttendanceExplanation::STATUS_PENDING, AttendanceExplanation::STATUS_APPROVED])
            ->get(['attendance_type', 'attendance_id', 'explanation_type']);

        $isExplained = function (string $type, int $id, string $explanationType) use ($existing): bool {
            return $existing->contains(fn ($row) =>
                $row->attendance_type === $type
                && (int) $row->attendance_id === $id
                && $row->explanation_type === $explanationType
            );
        };

        $staffAbsences = StaffAttendance::query()
            ->with('classroom')
            ->where('staff_id', $staffId)
            ->where('attendance_status', 'absent')
            ->whereDate('date', '>=', now()->subDays(14)->toDateString())
            ->latest('date')
            ->limit(20)
            ->get()
            ->reject(fn (StaffAttendance $record) => $isExplained(
                AttendanceExplanation::ATTENDANCE_STAFF,
                (int) $record->id,
                AttendanceExplanation::TYPE_ABSENCE,
            ))
            ->map(fn (StaffAttendance $record) => [
                'attendance_type' => AttendanceExplanation::ATTENDANCE_STAFF,
                'attendance_id' => $record->id,
                'timetable_id' => $record->timetable_id,
                'attendance_date' => $record->date?->format('Y-m-d'),
                'explanation_type' => AttendanceExplanation::TYPE_ABSENCE,
                'label' => 'Absence · ' . ($record->classroom?->name ?? 'Shift') . ' · ' . $record->date?->format('M j, Y'),
            ]);

        $staffEarly = StaffAttendance::query()
            ->with('classroom')
            ->where('staff_id', $staffId)
            ->where('departure_category', 'early_leave')
            ->whereDate('date', '>=', now()->subDays(14)->toDateString())
            ->latest('date')
            ->limit(20)
            ->get()
            ->reject(fn (StaffAttendance $record) => $isExplained(
                AttendanceExplanation::ATTENDANCE_STAFF,
                (int) $record->id,
                AttendanceExplanation::TYPE_EARLY_DEPARTURE,
            ))
            ->map(fn (StaffAttendance $record) => [
                'attendance_type' => AttendanceExplanation::ATTENDANCE_STAFF,
                'attendance_id' => $record->id,
                'timetable_id' => $record->timetable_id,
                'attendance_date' => $record->date?->format('Y-m-d'),
                'explanation_type' => AttendanceExplanation::TYPE_EARLY_DEPARTURE,
                'label' => 'Early departure · ' . ($record->classroom?->name ?? 'Shift') . ' · ' . $record->date?->format('M j, Y'),
            ]);

        $teacherAbsences = TeacherAttendance::query()
            ->with('classroom')
            ->where('teacher_id', $staffId)
            ->where('status', 'absent')
            ->whereDate('date', '>=', now()->subDays(14)->toDateString())
            ->latest('date')
            ->limit(20)
            ->get()
            ->reject(fn (TeacherAttendance $record) => $isExplained(
                AttendanceExplanation::ATTENDANCE_TEACHER,
                (int) $record->id,
                AttendanceExplanation::TYPE_ABSENCE,
            ))
            ->map(fn (TeacherAttendance $record) => [
                'attendance_type' => AttendanceExplanation::ATTENDANCE_TEACHER,
                'attendance_id' => $record->id,
                'timetable_id' => $record->timetable_id,
                'attendance_date' => $record->date?->format('Y-m-d'),
                'explanation_type' => AttendanceExplanation::TYPE_ABSENCE,
                'label' => 'Absence · ' . ($record->classroom?->name ?? 'Class') . ' · ' . $record->date?->format('M j, Y'),
            ]);

        $teacherEarly = TeacherAttendance::query()
            ->with('classroom')
            ->where('teacher_id', $staffId)
            ->where(function ($q) {
                $q->where('status', 'early_leave')->orWhere('departure_category', 'early_leave');
            })
            ->whereDate('date', '>=', now()->subDays(14)->toDateString())
            ->latest('date')
            ->limit(20)
            ->get()
            ->reject(fn (TeacherAttendance $record) => $isExplained(
                AttendanceExplanation::ATTENDANCE_TEACHER,
                (int) $record->id,
                AttendanceExplanation::TYPE_EARLY_DEPARTURE,
            ))
            ->map(fn (TeacherAttendance $record) => [
                'attendance_type' => AttendanceExplanation::ATTENDANCE_TEACHER,
                'attendance_id' => $record->id,
                'timetable_id' => $record->timetable_id,
                'attendance_date' => $record->date?->format('Y-m-d'),
                'explanation_type' => AttendanceExplanation::TYPE_EARLY_DEPARTURE,
                'label' => 'Early departure · ' . ($record->classroom?->name ?? 'Class') . ' · ' . $record->date?->format('M j, Y'),
            ]);

        return $staffAbsences
            ->concat($staffEarly)
            ->concat($teacherAbsences)
            ->concat($teacherEarly)
            ->values()
            ->all();
    }

    private function assertOwnsAttendance(int $staffId, string $type, int $attendanceId): void
    {
        $owns = match ($type) {
            AttendanceExplanation::ATTENDANCE_STAFF => StaffAttendance::query()
                ->where('id', $attendanceId)
                ->where('staff_id', $staffId)
                ->exists(),
            AttendanceExplanation::ATTENDANCE_TEACHER => TeacherAttendance::query()
                ->where('id', $attendanceId)
                ->where('teacher_id', $staffId)
                ->exists(),
            default => false,
        };

        if (!$owns) {
            abort(403, 'You are not authorized to explain this attendance record.');
        }
    }
}
