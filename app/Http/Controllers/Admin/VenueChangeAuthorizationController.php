<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClassRoom;
use App\Models\Teacher;
use App\Models\TimeTable;
use App\Models\VenueChangeAuthorization;
use App\Services\VenueChangeAuthorizationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class VenueChangeAuthorizationController extends Controller
{
    public function __construct(
        private VenueChangeAuthorizationService $service,
    ) {}

    public function index(Request $request): Response
    {
        $this->service->expireStale();

        $query = VenueChangeAuthorization::query()
            ->with(['staff', 'originalClassroom', 'authorizedClassroom', 'approver', 'timetable.course', 'timetable.classRoom'])
            ->latest('id');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($search = $request->get('search')) {
            $query->whereHas('staff', function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('employee_id', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        // Authorizations whose period contains this date.
        if ($activeOn = $request->get('active_on') ?: $request->get('date')) {
            $query->whereDate('start_date', '<=', $activeOn)
                ->whereDate('end_date', '>=', $activeOn);
        }

        if ($startDate = $request->get('start_date')) {
            $query->whereDate('start_date', $startDate);
        }

        if ($endDate = $request->get('end_date')) {
            $query->whereDate('end_date', $endDate);
        }

        $authorizations = $query->paginate(20)->withQueryString();

        $groupCounts = VenueChangeAuthorization::query()
            ->whereIn(
                'bulk_group_id',
                collect($authorizations->items())->pluck('bulk_group_id')->filter()->unique()->values()
            )
            ->selectRaw('bulk_group_id, COUNT(*) as aggregate')
            ->groupBy('bulk_group_id')
            ->pluck('aggregate', 'bulk_group_id');

        $authorizations->getCollection()->transform(function (VenueChangeAuthorization $auth) use ($groupCounts) {
            $auth->setAttribute('bulk_schedule_count', $auth->bulk_group_id
                ? (int) ($groupCounts[$auth->bulk_group_id] ?? 1)
                : 1);

            return $auth;
        });

        return Inertia::render('admin/venue-change-authorizations/index', [
            'authorizations' => $authorizations,
            'filters' => $request->only(['status', 'search', 'active_on', 'date', 'start_date', 'end_date']),
        ]);
    }

    public function create(): Response
    {
        $staff = Teacher::query()
            ->where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR)
            ->orderBy('first_name')
            ->get(['id', 'title', 'first_name', 'last_name', 'employee_id', 'email']);

        $venues = ClassRoom::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'latitude', 'longitude', 'radius_meters']);

        return Inertia::render('admin/venue-change-authorizations/create', [
            'staffMembers' => $staff,
            'venues' => $venues,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
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
        if (!$staff->isAdministrator()) {
            return back()->withErrors(['staff_id' => 'Venue change authorization is only available for administrators.']);
        }

        try {
            $created = $this->service->createBulk($data, $data['timetable_ids'], $request->user());
        } catch (\InvalidArgumentException $e) {
            return back()->withErrors(['timetable_ids' => $e->getMessage()])->withInput();
        }

        $count = $created->count();

        return redirect()
            ->route('admin.venue-change-authorizations.index')
            ->with('success', $count > 1
                ? "Created {$count} venue change authorizations in one bulk transaction."
                : 'Venue change authorization created successfully.');
    }

    public function show(VenueChangeAuthorization $venueChangeAuthorization): Response
    {
        $venueChangeAuthorization->load([
            'staff',
            'originalClassroom',
            'authorizedClassroom',
            'approver',
            'revoker',
            'timetable.course',
            'timetable.classRoom',
        ]);

        $bulkSiblings = collect();
        if ($venueChangeAuthorization->bulk_group_id) {
            $bulkSiblings = VenueChangeAuthorization::query()
                ->with(['timetable.course', 'timetable.classRoom', 'originalClassroom'])
                ->where('bulk_group_id', $venueChangeAuthorization->bulk_group_id)
                ->orderBy('id')
                ->get();
        }

        return Inertia::render('admin/venue-change-authorizations/show', [
            'authorization' => $venueChangeAuthorization,
            'bulkSiblings' => $bulkSiblings,
        ]);
    }

    public function revoke(Request $request, VenueChangeAuthorization $venueChangeAuthorization): RedirectResponse
    {
        $data = $request->validate([
            'revoke_reason' => ['nullable', 'string', 'max:500'],
            'revoke_bulk_group' => ['nullable', 'boolean'],
        ]);

        if ($venueChangeAuthorization->status !== VenueChangeAuthorization::STATUS_ACTIVE) {
            return back()->with('error', 'Only active authorizations can be revoked.');
        }

        $this->service->revoke(
            $venueChangeAuthorization,
            $request->user(),
            $data['revoke_reason'] ?? null,
            $request->boolean('revoke_bulk_group'),
        );

        return back()->with('success', $request->boolean('revoke_bulk_group')
            ? 'Bulk authorization group revoked.'
            : 'Authorization revoked.');
    }

    public function staffSchedules(Request $request, Teacher $teacher): \Illuminate\Http\JsonResponse
    {
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
}
