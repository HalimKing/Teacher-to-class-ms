<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\ClassRoom;
use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Models\TimeTable;
use App\Models\VenueChangeAuthorization;
use App\Models\VenueChangeRequest;
use App\Services\VenueChangeRequestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class VenueChangeRequestController extends Controller
{
    public function __construct(
        private VenueChangeRequestService $service,
    ) {}

    public function index(Request $request): Response
    {
        $staff = $request->user('teacher');
        $featureEnabled = SystemSetting::administratorVenueChangeRequestsEnabled();

        $requests = VenueChangeRequest::query()
            ->with(['authorizedClassroom', 'reviewer', 'items.timetable.course', 'items.originalClassroom'])
            ->where('staff_id', $staff->id)
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->latest('id')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('teacher/venue-change-requests/index', [
            'requests' => $requests,
            'filters' => $request->only(['status']),
            'featureEnabled' => $featureEnabled,
        ]);
    }

    public function create(): Response|RedirectResponse
    {
        if (!SystemSetting::administratorVenueChangeRequestsEnabled()) {
            return redirect()
                ->route('teacher.venue-change-requests.index')
                ->with('error', 'Administrator venue change requests are currently disabled by system settings.');
        }

        $venues = ClassRoom::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'latitude', 'longitude', 'radius_meters']);

        return Inertia::render('teacher/venue-change-requests/create', [
            'venues' => $venues,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        if (!SystemSetting::administratorVenueChangeRequestsEnabled()) {
            abort(403, 'Administrator venue change requests are currently disabled.');
        }

        /** @var Teacher $staff */
        $staff = $request->user('teacher');

        $data = $request->validate([
            'timetable_ids' => ['required', 'array', 'min:1'],
            'timetable_ids.*' => ['integer', 'distinct', 'exists:time_tables,id'],
            'authorized_classroom_id' => ['required', 'exists:class_rooms,id'],
            'authorization_type' => ['required', Rule::in([
                VenueChangeRequest::TYPE_CHECK_IN,
                VenueChangeRequest::TYPE_CHECK_OUT,
                VenueChangeRequest::TYPE_BOTH,
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

        try {
            $this->service->submit($staff, $data, $data['timetable_ids']);
        } catch (\InvalidArgumentException $e) {
            return back()->withErrors(['timetable_ids' => $e->getMessage()])->withInput();
        }

        return redirect()
            ->route('teacher.venue-change-requests.index')
            ->with('success', 'Venue change request submitted and is pending approval.');
    }

    public function show(Request $request, VenueChangeRequest $venueChangeRequest): Response
    {
        $staff = $request->user('teacher');

        if ((int) $venueChangeRequest->staff_id !== (int) $staff->id) {
            abort(403);
        }

        $venueChangeRequest->load([
            'authorizedClassroom',
            'reviewer',
            'items.timetable.course',
            'items.originalClassroom',
            'resultingAuthorization',
            'resultingAuthorizations.authorizedClassroom',
        ]);

        return Inertia::render('teacher/venue-change-requests/show', [
            'requestRecord' => $venueChangeRequest,
        ]);
    }

    public function cancel(Request $request, VenueChangeRequest $venueChangeRequest): RedirectResponse
    {
        /** @var Teacher $staff */
        $staff = $request->user('teacher');

        try {
            $this->service->cancel($venueChangeRequest, $staff);
        } catch (\InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Venue change request cancelled.');
    }

    public function mySchedules(Request $request): JsonResponse
    {
        if (!SystemSetting::administratorVenueChangeRequestsEnabled()) {
            abort(403, 'Administrator venue change requests are currently disabled.');
        }

        /** @var Teacher $staff */
        $staff = $request->user('teacher');

        $startDate = $request->query('start_date', $request->query('date', now()->toDateString()));
        $endDate = $request->query('end_date', $startDate);

        $existingAuth = VenueChangeAuthorization::query()
            ->active()
            ->where('staff_id', $staff->id)
            ->overlappingPeriod($startDate, $endDate)
            ->whereNotNull('timetable_id')
            ->get(['timetable_id', 'authorization_type', 'authorized_classroom_id', 'start_date', 'end_date']);

        $pendingRequests = VenueChangeRequest::query()
            ->with('items')
            ->pending()
            ->where('staff_id', $staff->id)
            ->whereDate('start_date', '<=', $endDate)
            ->whereDate('end_date', '>=', $startDate)
            ->get();

        $pendingByTimetable = [];
        foreach ($pendingRequests as $pending) {
            foreach ($pending->items as $item) {
                $pendingByTimetable[$item->timetable_id][] = [
                    'request_id' => $pending->id,
                    'authorization_type' => $pending->authorization_type,
                    'period_label' => $pending->period_label,
                ];
            }
        }

        $conflictMap = $existingAuth->groupBy('timetable_id')->map(fn ($rows) => $rows->map(fn ($row) => [
            'authorization_type' => $row->authorization_type,
            'authorized_classroom_id' => $row->authorized_classroom_id,
            'start_date' => $row->start_date?->toDateString(),
            'end_date' => $row->end_date?->toDateString(),
            'period_label' => $row->period_label,
            'source' => 'authorization',
        ])->values());

        $schedules = TimeTable::query()
            ->with(['classRoom', 'course'])
            ->where('teacher_id', $staff->id)
            ->where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR)
            ->orderBy('day_of_week')
            ->orderBy('start_time')
            ->get()
            ->map(function (TimeTable $schedule) use ($conflictMap, $pendingByTimetable, $startDate, $endDate) {
                $authConflicts = $conflictMap->get((string) $schedule->id) ?? $conflictMap->get($schedule->id) ?? collect();
                $pendingConflicts = collect($pendingByTimetable[$schedule->id] ?? []);

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
                    'has_conflict' => $authConflicts->isNotEmpty() || $pendingConflicts->isNotEmpty(),
                    'conflicts' => $authConflicts->concat($pendingConflicts)->values(),
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
