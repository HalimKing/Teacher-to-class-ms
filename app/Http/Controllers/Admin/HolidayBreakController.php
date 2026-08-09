<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\HolidayBreak;
use App\Models\HolidayBreakCoverageAssignment;
use App\Models\HolidayBreakDutyAssignment;
use App\Models\Teacher;
use App\Services\HolidayBreakService;
use App\Support\HolidayBreakCoverage;
use App\Support\HolidayBreakType;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class HolidayBreakController extends Controller
{
    public function __construct(
        private HolidayBreakService $holidayBreaks,
    ) {}

    public function index(Request $request): Response
    {
        $query = HolidayBreak::query()
            ->with(['creator:id,name', 'dutyAssignments', 'coverageAssignments'])
            ->withCount(['dutyAssignments', 'coverageAssignments'])
            ->orderByDesc('start_date');

        if ($request->filled('type') && $request->string('type') !== 'all') {
            $query->where('type', $request->string('type'));
        }

        if ($request->filled('status') && $request->string('status') !== 'all') {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('from')) {
            $query->whereDate('end_date', '>=', $request->date('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('start_date', '<=', $request->date('to'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search')->toString();
            $query->where(function ($builder) use ($search) {
                $builder->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $breaks = $query->paginate((int) $request->input('per_page', 15))->withQueryString();
        $overlappingIds = $this->overlappingActiveBreakIds();

        return Inertia::render('admin/holidays-breaks/index', [
            'filters' => [
                'search' => $request->input('search', ''),
                'type' => $request->input('type', 'all'),
                'status' => $request->input('status', 'all'),
                'from' => $request->input('from', ''),
                'to' => $request->input('to', ''),
            ],
            'typeOptions' => HolidayBreakType::labels(),
            'coverageOptions' => HolidayBreakCoverage::labels(),
            'overlappingIds' => $overlappingIds,
            'holidayBreaks' => $breaks->through(fn (HolidayBreak $break) => $this->transformBreak($break, $overlappingIds)),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('admin/holidays-breaks/create', [
            'typeOptions' => HolidayBreakType::labels(),
            'coverageOptions' => HolidayBreakCoverage::labels(),
            'coverageDescriptions' => $this->coverageDescriptions(),
            'teachers' => $this->teacherOptions(),
            'staffCounts' => $this->staffCounts(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validateBreak($request);
        $coverageTeacherIds = $this->validatedCoverageTeacherIds($request, $validated['coverage_type']);

        $break = HolidayBreak::create([
            'name' => $validated['name'],
            'type' => $validated['type'],
            'start_date' => $validated['start_date'],
            'end_date' => $validated['end_date'],
            'description' => $validated['description'] ?? null,
            'status' => $validated['status'],
            'coverage_type' => $validated['coverage_type'],
            'created_by' => $request->user()?->id,
        ]);

        $this->syncCoverageAssignments($break, $coverageTeacherIds, $request->user()?->id);

        return redirect()
            ->route('admin.holidays-breaks.show', $break)
            ->with('success', 'Holiday / break period created successfully.');
    }

    public function show(HolidayBreak $holidayBreak): Response
    {
        $break = $holidayBreak->load([
            'creator:id,name',
            'dutyAssignments.teacher.department',
            'dutyAssignments.teacher.faculty',
            'coverageAssignments.teacher.department',
        ]);

        $eligibleDutyTeachers = $this->holidayBreaks->eligibleDutyTeachers($break);
        $assignedDutyIds = $break->dutyAssignments->pluck('teacher_id')->all();

        return Inertia::render('admin/holidays-breaks/show', [
            'holidayBreak' => $this->transformBreak($break),
            'coverageAssignments' => $break->coverageAssignments->map(fn (HolidayBreakCoverageAssignment $assignment) => [
                'id' => $assignment->id,
                'teacher_id' => $assignment->teacher_id,
                'teacher_name' => trim("{$assignment->teacher?->title} {$assignment->teacher?->first_name} {$assignment->teacher?->last_name}"),
                'employee_id' => $assignment->teacher?->employee_id,
                'staff_type' => $assignment->teacher?->staff_type,
                'department' => $assignment->teacher?->department?->name,
            ]),
            'dutyAssignments' => $break->dutyAssignments->map(fn (HolidayBreakDutyAssignment $assignment) => [
                'id' => $assignment->id,
                'teacher_id' => $assignment->teacher_id,
                'teacher_name' => trim("{$assignment->teacher?->title} {$assignment->teacher?->first_name} {$assignment->teacher?->last_name}"),
                'employee_id' => $assignment->teacher?->employee_id,
                'staff_type' => $assignment->teacher?->staff_type,
                'department' => $assignment->teacher?->department?->name,
                'duty_dates' => $assignment->duty_dates,
                'notes' => $assignment->notes,
            ]),
            'eligibleDutyTeachers' => $eligibleDutyTeachers
                ->reject(fn (Teacher $teacher) => in_array($teacher->id, $assignedDutyIds, true))
                ->map(fn (Teacher $teacher) => $this->mapTeacher($teacher))
                ->values(),
            'coverageOptions' => HolidayBreakCoverage::labels(),
            'typeOptions' => HolidayBreakType::labels(),
            'canAssignAllEligible' => HolidayBreakCoverage::isAllCoverage($break->coverage_type)
                || HolidayBreakCoverage::requiresStaffSelection($break->coverage_type),
            'eligibleDutyCount' => $eligibleDutyTeachers->count(),
        ]);
    }

    public function edit(HolidayBreak $holidayBreak): Response
    {
        $holidayBreak->load('coverageAssignments');

        return Inertia::render('admin/holidays-breaks/edit', [
            'holidayBreak' => $this->transformBreak($holidayBreak),
            'coverageTeacherIds' => $holidayBreak->coverageAssignments->pluck('teacher_id')->values()->all(),
            'typeOptions' => HolidayBreakType::labels(),
            'coverageOptions' => HolidayBreakCoverage::labels(),
            'coverageDescriptions' => $this->coverageDescriptions(),
            'teachers' => $this->teacherOptions(),
            'staffCounts' => $this->staffCounts(),
        ]);
    }

    public function update(Request $request, HolidayBreak $holidayBreak): RedirectResponse
    {
        $validated = $this->validateBreak($request);
        $coverageTeacherIds = $this->validatedCoverageTeacherIds($request, $validated['coverage_type']);

        $holidayBreak->update([
            'name' => $validated['name'],
            'type' => $validated['type'],
            'start_date' => $validated['start_date'],
            'end_date' => $validated['end_date'],
            'description' => $validated['description'] ?? null,
            'status' => $validated['status'],
            'coverage_type' => $validated['coverage_type'],
        ]);

        $this->syncCoverageAssignments($holidayBreak, $coverageTeacherIds, $request->user()?->id);
        $this->pruneInvalidDutyAssignments($holidayBreak);

        return redirect()
            ->route('admin.holidays-breaks.show', $holidayBreak)
            ->with('success', 'Holiday / break period updated successfully.');
    }

    public function destroy(HolidayBreak $holidayBreak): RedirectResponse
    {
        $holidayBreak->delete();

        return redirect()
            ->route('admin.holidays-breaks.index')
            ->with('success', 'Holiday / break period deleted successfully.');
    }

    public function toggleStatus(Request $request, HolidayBreak $holidayBreak): RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in([HolidayBreak::STATUS_ACTIVE, HolidayBreak::STATUS_INACTIVE])],
        ]);

        $holidayBreak->update(['status' => $validated['status']]);

        return back()->with('success', 'Holiday / break status updated.');
    }

    public function storeDuty(Request $request, HolidayBreak $holidayBreak): RedirectResponse
    {
        $validated = $request->validate([
            'teacher_ids' => ['required', 'array', 'min:1'],
            'teacher_ids.*' => ['integer', 'distinct', 'exists:teachers,id'],
            'duty_dates' => ['nullable', 'array'],
            'duty_dates.*' => ['date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $eligibleIds = $this->holidayBreaks->eligibleDutyTeachers($holidayBreak)->pluck('id')->all();
        $teacherIds = array_values(array_intersect(
            array_unique(array_map('intval', $validated['teacher_ids'])),
            $eligibleIds,
        ));

        if ($teacherIds === []) {
            throw ValidationException::withMessages([
                'teacher_ids' => 'Select staff who are covered by this holiday/break.',
            ]);
        }

        $dutyDates = $this->normalizeDutyDates(
            $validated['duty_dates'] ?? null,
            $holidayBreak->start_date->toDateString(),
            $holidayBreak->end_date->toDateString(),
        );

        $created = $this->createDutyAssignments(
            $holidayBreak,
            $teacherIds,
            $dutyDates,
            $validated['notes'] ?? null,
            $request->user()?->id,
        );

        if ($created === 0) {
            return back()->with('error', 'No new staff members were assigned. They may already be on break duty.');
        }

        $label = $created === 1 ? '1 staff member assigned' : "{$created} staff members assigned";

        return back()->with('success', "{$label} to break duty.");
    }

    public function assignAllDuty(Request $request, HolidayBreak $holidayBreak): RedirectResponse
    {
        $validated = $request->validate([
            'duty_dates' => ['nullable', 'array'],
            'duty_dates.*' => ['date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $eligibleIds = $this->holidayBreaks->eligibleDutyTeachers($holidayBreak)->pluck('id')->all();
        if ($eligibleIds === []) {
            return back()->with('error', 'There are no eligible staff to assign to break duty.');
        }

        $dutyDates = $this->normalizeDutyDates(
            $validated['duty_dates'] ?? null,
            $holidayBreak->start_date->toDateString(),
            $holidayBreak->end_date->toDateString(),
        );

        $created = $this->createDutyAssignments(
            $holidayBreak,
            $eligibleIds,
            $dutyDates,
            $validated['notes'] ?? null,
            $request->user()?->id,
        );

        if ($created === 0) {
            return back()->with('error', 'All eligible staff are already assigned to break duty.');
        }

        return back()->with('success', "{$created} eligible staff member(s) assigned to break duty.");
    }

    public function updateDuty(Request $request, HolidayBreak $holidayBreak, HolidayBreakDutyAssignment $dutyAssignment): RedirectResponse
    {
        abort_unless($dutyAssignment->holiday_break_id === $holidayBreak->id, 404);

        $validated = $request->validate([
            'duty_dates' => ['nullable', 'array'],
            'duty_dates.*' => ['date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $dutyDates = $this->normalizeDutyDates(
            $validated['duty_dates'] ?? null,
            $holidayBreak->start_date->toDateString(),
            $holidayBreak->end_date->toDateString(),
        );

        $dutyAssignment->update([
            'duty_dates' => $dutyDates,
            'notes' => $validated['notes'] ?? null,
        ]);

        return back()->with('success', 'Break duty assignment updated.');
    }

    public function destroyDuty(HolidayBreak $holidayBreak, HolidayBreakDutyAssignment $dutyAssignment): RedirectResponse
    {
        abort_unless($dutyAssignment->holiday_break_id === $holidayBreak->id, 404);

        $dutyAssignment->delete();

        return back()->with('success', 'Break duty assignment removed.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validateBreak(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in(HolidayBreakType::values())],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'description' => ['nullable', 'string', 'max:2000'],
            'status' => ['required', Rule::in([HolidayBreak::STATUS_ACTIVE, HolidayBreak::STATUS_INACTIVE])],
            'coverage_type' => ['required', Rule::in(HolidayBreakCoverage::values())],
            'coverage_teacher_ids' => ['nullable', 'array'],
            'coverage_teacher_ids.*' => ['integer', 'distinct', 'exists:teachers,id'],
        ]);
    }

    /**
     * @return list<int>
     */
    private function validatedCoverageTeacherIds(Request $request, string $coverageType): array
    {
        if (! HolidayBreakCoverage::requiresStaffSelection($coverageType)) {
            return [];
        }

        $ids = array_values(array_unique(array_map('intval', $request->input('coverage_teacher_ids', []))));
        if ($ids === []) {
            throw ValidationException::withMessages([
                'coverage_teacher_ids' => 'Select at least one staff member for this coverage option.',
            ]);
        }

        $staffType = HolidayBreakCoverage::staffTypeFilter($coverageType);
        $query = Teacher::query()->whereIn('id', $ids);
        if ($staffType) {
            $query->where('staff_type', $staffType);
        }

        $validIds = $query->pluck('id')->map(fn ($id) => (int) $id)->all();
        if (count($validIds) !== count($ids)) {
            throw ValidationException::withMessages([
                'coverage_teacher_ids' => 'One or more selected staff members do not match the chosen coverage type.',
            ]);
        }

        return $validIds;
    }

    /**
     * @param  list<int>  $teacherIds
     */
    private function syncCoverageAssignments(HolidayBreak $break, array $teacherIds, ?int $createdBy): void
    {
        HolidayBreakCoverageAssignment::query()
            ->where('holiday_break_id', $break->id)
            ->delete();

        foreach ($teacherIds as $teacherId) {
            HolidayBreakCoverageAssignment::create([
                'holiday_break_id' => $break->id,
                'teacher_id' => $teacherId,
                'created_by' => $createdBy,
            ]);
        }
    }

    private function pruneInvalidDutyAssignments(HolidayBreak $break): void
    {
        $eligibleIds = $this->holidayBreaks
            ->eligibleDutyTeachers($break->fresh(['coverageAssignments']))
            ->pluck('id')
            ->all();

        $query = HolidayBreakDutyAssignment::query()->where('holiday_break_id', $break->id);

        if ($eligibleIds === []) {
            $query->delete();

            return;
        }

        $query->whereNotIn('teacher_id', $eligibleIds)->delete();
    }

    /**
     * @param  list<int>  $teacherIds
     */
    private function createDutyAssignments(
        HolidayBreak $holidayBreak,
        array $teacherIds,
        ?array $dutyDates,
        ?string $notes,
        ?int $createdBy,
    ): int {
        $created = 0;

        foreach ($teacherIds as $teacherId) {
            $exists = HolidayBreakDutyAssignment::query()
                ->where('holiday_break_id', $holidayBreak->id)
                ->where('teacher_id', $teacherId)
                ->exists();

            if ($exists) {
                continue;
            }

            HolidayBreakDutyAssignment::create([
                'holiday_break_id' => $holidayBreak->id,
                'teacher_id' => $teacherId,
                'duty_dates' => $dutyDates,
                'notes' => $notes,
                'created_by' => $createdBy,
            ]);
            $created++;
        }

        return $created;
    }

    /**
     * @param  list<string>|null  $dates
     * @return list<string>|null
     */
    private function normalizeDutyDates(?array $dates, string $start, string $end): ?array
    {
        if ($dates === null || $dates === []) {
            return null;
        }

        $normalized = collect($dates)
            ->map(fn ($date) => Carbon::parse($date)->toDateString())
            ->filter(fn (string $date) => $date >= $start && $date <= $end)
            ->unique()
            ->sort()
            ->values()
            ->all();

        return $normalized === [] ? null : $normalized;
    }

    /**
     * @return list<int>
     */
    private function overlappingActiveBreakIds(): array
    {
        $active = HolidayBreak::query()->active()->orderBy('start_date')->get(['id', 'start_date', 'end_date']);
        $ids = [];

        foreach ($active as $index => $left) {
            foreach ($active->slice($index + 1) as $right) {
                if ($left->start_date <= $right->end_date && $right->start_date <= $left->end_date) {
                    $ids[] = $left->id;
                    $ids[] = $right->id;
                }
            }
        }

        return array_values(array_unique($ids));
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function teacherOptions(): Collection
    {
        return Teacher::query()
            ->with(['department:id,name', 'faculty:id,name'])
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->get()
            ->map(fn (Teacher $teacher) => $this->mapTeacher($teacher));
    }

    /**
     * @return array<string, int>
     */
    private function staffCounts(): array
    {
        return [
            'all' => Teacher::query()->count(),
            'administrators' => Teacher::query()->where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR)->count(),
            'lecturers' => Teacher::query()->where('staff_type', Teacher::STAFF_TYPE_LECTURER)->count(),
        ];
    }

    /**
     * @return array<string, string>
     */
    private function coverageDescriptions(): array
    {
        $descriptions = [];
        foreach (HolidayBreakCoverage::values() as $value) {
            $descriptions[$value] = HolidayBreakCoverage::description($value);
        }

        return $descriptions;
    }

    /**
     * @return array<string, mixed>
     */
    private function mapTeacher(Teacher $teacher): array
    {
        return [
            'id' => $teacher->id,
            'name' => trim("{$teacher->title} {$teacher->first_name} {$teacher->last_name}"),
            'employee_id' => $teacher->employee_id,
            'staff_type' => $teacher->staff_type,
            'department' => $teacher->department?->name,
            'faculty' => $teacher->faculty?->name,
        ];
    }

    /**
     * @param  list<int>|null  $overlappingIds
     * @return array<string, mixed>
     */
    private function transformBreak(HolidayBreak $break, ?array $overlappingIds = null): array
    {
        return [
            'id' => $break->id,
            'name' => $break->name,
            'type' => $break->type,
            'type_label' => HolidayBreakType::label($break->type),
            'coverage_type' => $break->coverage_type ?: HolidayBreakCoverage::ALL_STAFF,
            'coverage_label' => HolidayBreakCoverage::label($break->coverage_type),
            'coverage_description' => HolidayBreakCoverage::description($break->coverage_type),
            'requires_staff_selection' => HolidayBreakCoverage::requiresStaffSelection($break->coverage_type),
            'start_date' => $break->start_date?->toDateString(),
            'end_date' => $break->end_date?->toDateString(),
            'description' => $break->description,
            'status' => $break->status,
            'created_by' => $break->created_by,
            'created_by_name' => $break->creator?->name,
            'created_at' => $break->created_at?->toDateTimeString(),
            'duty_assignments_count' => $break->duty_assignments_count
                ?? $break->dutyAssignments?->count()
                ?? 0,
            'coverage_assignments_count' => $break->coverage_assignments_count
                ?? $break->coverageAssignments?->count()
                ?? 0,
            'covered_staff_count' => $this->holidayBreaks->coveredStaffCount($break),
            'overlaps' => $overlappingIds ? in_array($break->id, $overlappingIds, true) : false,
        ];
    }
}
