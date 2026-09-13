<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\ClassRoom;
use App\Models\Teacher;
use App\Models\TimeTable;
use App\Models\VenueChangeAuthorization;
use App\Services\LeadershipScope;
use App\Services\VenueChangeAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class UnitVenueChangeAuthorizationController extends Controller
{
    public function __construct(
        private LeadershipScope $leadershipScope,
        private VenueChangeAuthorizationService $authorizationService,
    ) {}

    public function index(Request $request): Response
    {
        /** @var Teacher $leader */
        $leader = auth('teacher')->user();

        $this->authorizationService->expireStale();

        $query = $this->scopedAuthorizations($leader)
            ->with([
                'staff.faculty',
                'staff.department',
                'originalClassroom',
                'authorizedClassroom',
                'approver',
                'teacherApprover',
                'timetable.course',
                'sourceRequest',
            ])
            ->latest('id');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($request->filled('teacher_id')) {
            $staffId = (int) $request->teacher_id;
            abort_unless($this->scopedStaffIds($leader)->contains($staffId), 403);
            $query->where('staff_id', $staffId);
        }

        $authorizations = $query->paginate(20)->withQueryString();
        $authorizations->setCollection(
            $authorizations->getCollection()->map(fn (VenueChangeAuthorization $row) => $this->serialize($row))
        );

        $scoped = $this->scopedAuthorizations($leader);

        return Inertia::render('teacher/unit/venue-change-authorizations', [
            'authorizations' => $authorizations,
            'staff' => $this->leadershipScope->applyToTeachers(Teacher::query(), $leader)
                ->orderBy('first_name')
                ->get(['id', 'first_name', 'last_name', 'title', 'employee_id', 'staff_type']),
            'filters' => $request->only(['status', 'teacher_id']),
            'leadershipScope' => $this->leadershipScope->summary($leader),
            'statusCounts' => [
                'active' => (clone $scoped)->where('status', VenueChangeAuthorization::STATUS_ACTIVE)->count(),
                'expired' => (clone $scoped)->where('status', VenueChangeAuthorization::STATUS_EXPIRED)->count(),
                'revoked' => (clone $scoped)->where('status', VenueChangeAuthorization::STATUS_REVOKED)->count(),
            ],
        ]);
    }

    public function show(VenueChangeAuthorization $venueChangeAuthorization): Response
    {
        /** @var Teacher $leader */
        $leader = auth('teacher')->user();

        abort_unless($this->canReview($leader, $venueChangeAuthorization), 403);

        $venueChangeAuthorization->load([
            'staff.faculty',
            'staff.department',
            'originalClassroom',
            'authorizedClassroom',
            'approver',
            'teacherApprover',
            'revoker',
            'timetable.course',
            'timetable.classRoom',
            'sourceRequest',
        ]);

        $bulkSiblings = collect();
        if ($venueChangeAuthorization->bulk_group_id) {
            $bulkSiblings = VenueChangeAuthorization::query()
                ->with(['timetable.course', 'timetable.classRoom', 'originalClassroom'])
                ->where('bulk_group_id', $venueChangeAuthorization->bulk_group_id)
                ->orderBy('id')
                ->get()
                ->map(fn (VenueChangeAuthorization $sibling) => [
                    'id' => $sibling->id,
                    'status' => $sibling->status,
                    'session_label' => $this->sessionLabel($sibling),
                    'original_venue' => $sibling->originalClassroom?->name,
                ]);
        }

        return Inertia::render('teacher/unit/venue-change-authorization-show', [
            'authorization' => $this->serialize($venueChangeAuthorization, detailed: true),
            'bulkSiblings' => $bulkSiblings,
            'leadershipScope' => $this->leadershipScope->summary($leader),
        ]);
    }

    public function create(): Response
    {
        /** @var Teacher $leader */
        $leader = auth('teacher')->user();

        $staff = $this->leadershipScope->applyToTeachers(Teacher::query(), $leader)
            ->where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR)
            ->orderBy('first_name')
            ->get(['id', 'title', 'first_name', 'last_name', 'employee_id', 'email']);

        $venues = ClassRoom::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'latitude', 'longitude', 'radius_meters']);

        return Inertia::render('teacher/unit/venue-change-authorization-create', [
            'staffMembers' => $staff,
            'venues' => $venues,
            'leadershipScope' => $this->leadershipScope->summary($leader),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        /** @var Teacher $leader */
        $leader = auth('teacher')->user();

        $data = $request->validate([
            'staff_id' => ['required', 'exists:teachers,id'],
            'timetable_ids' => ['required', 'array', 'min:1'],
            'timetable_ids.*' => ['integer', 'distinct', 'exists:time_tables,id'],
            'authorized_classroom_id' => ['required', 'exists:class_rooms,id'],
            'authorization_type' => ['required', Rule::in([
                VenueChangeAuthorization::TYPE_CHECK_IN,
                VenueChangeAuthorization::TYPE_CHECK_OUT,
                VenueChangeAuthorization::TYPE_BOTH,
            ])],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'end_time' => [
                'nullable',
                'date_format:H:i',
                function (string $attribute, mixed $value, \Closure $fail) use ($request) {
                    $start = $request->input('start_time');
                    if ($value && $start && $value <= $start) {
                        $fail('The end time must be after the start time.');
                    }
                },
            ],
            'reason' => ['required', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $staff = Teacher::query()->findOrFail($data['staff_id']);

        abort_unless($this->leadershipScope->canManage($leader, $staff), 403);

        if (!$staff->isAdministrator()) {
            return back()->withErrors(['staff_id' => 'Venue change authorization is only available for administrators.']);
        }

        try {
            $created = $this->authorizationService->createBulk($data, $data['timetable_ids'], $leader);
        } catch (\InvalidArgumentException $e) {
            return back()->withErrors(['timetable_ids' => $e->getMessage()])->withInput();
        }

        $count = $created->count();

        return redirect()
            ->route('teacher.unit.venue-change-authorizations.index')
            ->with('success', $count > 1
                ? "Created {$count} venue change authorizations in one bulk transaction."
                : 'Venue change authorization created successfully.');
    }

    public function staffSchedules(Request $request, Teacher $teacher): JsonResponse
    {
        /** @var Teacher $leader */
        $leader = auth('teacher')->user();

        abort_unless($this->leadershipScope->canManage($leader, $teacher), 403);

        $startDate = $request->query('start_date', $request->query('date', now()->toDateString()));
        $endDate = $request->query('end_date', $startDate);

        $existing = VenueChangeAuthorization::query()
            ->active()
            ->where('staff_id', $teacher->id)
            ->overlappingPeriod($startDate, $endDate)
            ->whereNotNull('timetable_id')
            ->get(['timetable_id', 'authorization_type', 'authorized_classroom_id', 'start_date', 'end_date']);

        $conflictMap = $existing->groupBy('timetable_id')->map(fn ($rows) => $rows->map(fn ($row) => [
            'authorization_type' => $row->authorization_type,
            'authorized_classroom_id' => $row->authorized_classroom_id,
            'start_date' => $row->start_date?->toDateString(),
            'end_date' => $row->end_date?->toDateString(),
            'period_label' => $row->period_label,
        ])->values());

        $schedules = TimeTable::query()
            ->with(['classRoom', 'course'])
            ->where('teacher_id', $teacher->id)
            ->where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR)
            ->orderBy('day_of_week')
            ->orderBy('start_time')
            ->get()
            ->map(function (TimeTable $schedule) use ($conflictMap, $startDate, $endDate) {
                $conflicts = $conflictMap->get((string) $schedule->id) ?? $conflictMap->get($schedule->id) ?? collect();

                return [
                    'id' => $schedule->id,
                    'day' => $schedule->day_of_week ?? $schedule->day,
                    'start_time' => $schedule->start_time,
                    'end_time' => $schedule->end_time,
                    'classroom_id' => $schedule->class_room_id,
                    'classroom' => $schedule->classRoom?->name,
                    'course' => $schedule->course?->name ?? 'Work period',
                    'course_code' => $schedule->course?->course_code,
                    'class_label' => $schedule->classRoom?->name ?? 'Unassigned venue',
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'has_conflict' => $conflicts->isNotEmpty(),
                    'conflicts' => $conflicts,
                    'search_text' => strtolower(trim(implode(' ', array_filter([
                        $schedule->course?->name,
                        $schedule->course?->course_code,
                        $schedule->classRoom?->name,
                        $schedule->day_of_week ?? $schedule->day,
                        $schedule->start_time,
                        $schedule->end_time,
                    ])))),
                ];
            });

        return response()->json(['success' => true, 'data' => $schedules]);
    }

    private function scopedAuthorizations(Teacher $leader)
    {
        $staffIds = $this->scopedStaffIds($leader);

        return VenueChangeAuthorization::query()->whereIn('staff_id', $staffIds);
    }

    /**
     * @return \Illuminate\Support\Collection<int, int>
     */
    private function scopedStaffIds(Teacher $leader)
    {
        return $this->leadershipScope->applyToTeachers(Teacher::query(), $leader)->pluck('id');
    }

    private function canReview(Teacher $leader, VenueChangeAuthorization $authorization): bool
    {
        $authorization->loadMissing('staff');

        return $authorization->staff instanceof Teacher
            && $this->leadershipScope->canManage($leader, $authorization->staff);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(VenueChangeAuthorization $authorization, bool $detailed = false): array
    {
        $authorization->loadMissing([
            'staff.faculty',
            'staff.department',
            'originalClassroom',
            'authorizedClassroom',
            'approver',
            'teacherApprover',
            'revoker',
            'timetable.course',
            'sourceRequest',
        ]);

        $staff = $authorization->staff;
        $payload = [
            'id' => $authorization->id,
            'status' => $authorization->status,
            'status_label' => ucfirst($authorization->status),
            'authorization_type' => $authorization->authorization_type,
            'period_label' => $authorization->period_label,
            'start_time' => $authorization->start_time,
            'end_time' => $authorization->end_time,
            'reason' => $authorization->reason,
            'notes' => $authorization->notes,
            'staff_id' => $authorization->staff_id,
            'staff_name' => $staff?->displayName(),
            'employee_id' => $staff?->employee_id,
            'staff_role' => $staff?->staffTypeLabel(),
            'faculty_name' => $staff?->faculty?->name,
            'department_name' => $staff?->department?->name,
            'original_venue' => $authorization->originalClassroom?->name ?? '—',
            'authorized_venue' => $authorization->authorizedClassroom?->name ?? '—',
            'session_label' => $this->sessionLabel($authorization),
            'source_request_id' => $authorization->source_request_id,
            'approved_by_name' => $authorization->approvedByName(),
            'approved_at_display' => $authorization->approved_at?->timezone(config('app.timezone'))->format('M j, Y g:i A'),
        ];

        if ($detailed) {
            $payload['revoked_by_name'] = $authorization->revoker?->name;
            $payload['revoked_at_display'] = $authorization->revoked_at?->timezone(config('app.timezone'))->format('M j, Y g:i A');
            $payload['revoke_reason'] = $authorization->revoke_reason;
            $payload['bulk_group_id'] = $authorization->bulk_group_id;
        }

        return $payload;
    }

    private function sessionLabel(VenueChangeAuthorization $authorization): string
    {
        $course = $authorization->timetable?->course?->name ?: 'Work period';
        $day = $authorization->timetable?->day_of_week ?: $authorization->timetable?->day;
        $time = trim(($authorization->timetable?->start_time ?? '').'–'.($authorization->timetable?->end_time ?? ''), '–');

        return trim($course.($day ? " · {$day}" : '').($time ? " {$time}" : '')) ?: 'Attendance session';
    }
}
