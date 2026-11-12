<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Http\Requests\Teacher\AttendanceReminderRequest;
use App\Models\AttendanceReminder;
use App\Models\AttendanceReminderDispatch;
use App\Models\Teacher;
use App\Services\ActivityLogService;
use App\Services\AttendanceReminderService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AttendanceReminderController extends Controller
{
    public function __construct(
        private AttendanceReminderService $reminders,
        private ActivityLogService $activityLog,
    ) {}

    public function index(Request $request): Response
    {
        $teacher = $this->teacher();
        $query = $this->reminders->visibleQuery($teacher);

        if ($request->filled('search')) {
            $query->where('title', 'like', '%'.trim((string) $request->input('search')).'%');
        }

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('day')) {
            $query->whereJsonContains('days', $request->input('day'));
        }

        if ($request->input('status') === 'active') {
            $query->where('is_active', true);
        } elseif ($request->input('status') === 'inactive') {
            $query->where('is_active', false);
        }

        $summaryQuery = $this->reminders->visibleQuery($teacher);
        $activeReminders = (clone $summaryQuery)->where('is_active', true)->with('teacher')->get();
        $upcoming = 0;

        foreach ($activeReminders as $reminder) {
            $upcoming += $this->reminders->previewUpcomingCount($reminder);
        }

        $reminders = $query
            ->with('teacher')
            ->latest()
            ->paginate(10)
            ->withQueryString()
            ->through(fn (AttendanceReminder $reminder) => $this->listPayload($reminder));

        return Inertia::render('teacher/attendance-reminders/index', [
            'reminders' => $reminders,
            'summary' => [
                'total' => (clone $summaryQuery)->count(),
                'active' => $activeReminders->count(),
                'inactive' => (clone $summaryQuery)->where('is_active', false)->count(),
                'upcoming' => $upcoming,
            ],
            'usage' => [
                'used' => $this->reminders->usage($teacher),
                'limit' => $this->reminders->limit(),
            ],
            'filters' => $request->only(['search', 'type', 'day', 'status']),
            'days' => AttendanceReminder::DAYS,
            'can' => [
                'create' => $this->reminders->canCreate($teacher),
                'edit' => true,
                'delete' => true,
            ],
        ]);
    }

    public function create(): Response
    {
        $teacher = $this->teacher();
        abort_unless($this->reminders->canCreate($teacher), 403);

        return Inertia::render('teacher/attendance-reminders/form', $this->formOptions($teacher, null));
    }

    public function store(AttendanceReminderRequest $request): RedirectResponse
    {
        $teacher = $this->teacher();

        $reminder = AttendanceReminder::query()->create([
            ...$this->attributes($request),
            'teacher_id' => $teacher->id,
            'days' => [],
            'recipient_scope' => AttendanceReminder::SCOPE_SELF,
        ]);
        $this->reminders->syncSchedules($reminder, $request->validated('timetable_ids'));

        $this->log('reminder_created', 'Created personal attendance reminder '.$reminder->title, $reminder);

        return redirect()
            ->route('teacher.attendance-reminders.index')
            ->with('success', 'Reminder created. It will repeat on the selected days until you disable or delete it.');
    }

    public function show(AttendanceReminder $attendanceReminder): Response
    {
        $this->owns($attendanceReminder);

        $history = $attendanceReminder->dispatches()
            ->latest('scheduled_for')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (AttendanceReminderDispatch $dispatch) => [
                'id' => $dispatch->id,
                'session_date' => $dispatch->session_date?->toDateString(),
                'scheduled_for' => $dispatch->scheduled_for?->format('D, M j, Y g:i A'),
                'notified_at' => $dispatch->notified_at?->format('D, M j, Y g:i A'),
                'channel' => $dispatch->channel,
                'status' => $dispatch->status,
                'failure_reason' => $dispatch->failure_reason,
            ]);

        return Inertia::render('teacher/attendance-reminders/show', [
            'reminder' => $this->detailPayload($attendanceReminder),
            'upcoming' => $this->reminders->upcoming($attendanceReminder, now(), 14, 30),
            'history' => $history,
            'can' => ['edit' => true, 'delete' => true],
        ]);
    }

    public function edit(AttendanceReminder $attendanceReminder): Response
    {
        $this->owns($attendanceReminder);

        return Inertia::render('teacher/attendance-reminders/form', $this->formOptions($this->teacher(), $attendanceReminder));
    }

    public function update(AttendanceReminderRequest $request, AttendanceReminder $attendanceReminder): RedirectResponse
    {
        $this->owns($attendanceReminder);
        $attendanceReminder->update($this->attributes($request));
        $this->reminders->syncSchedules($attendanceReminder, $request->validated('timetable_ids'));
        $this->log('reminder_updated', 'Updated personal attendance reminder '.$attendanceReminder->title, $attendanceReminder);

        return redirect()
            ->route('teacher.attendance-reminders.index')
            ->with('success', 'Reminder updated.');
    }

    public function toggle(AttendanceReminder $attendanceReminder): RedirectResponse
    {
        $this->owns($attendanceReminder);
        $attendanceReminder->update(['is_active' => ! $attendanceReminder->is_active]);
        $this->log(
            'reminder_toggled',
            ($attendanceReminder->is_active ? 'Activated' : 'Deactivated').' personal attendance reminder '.$attendanceReminder->title,
            $attendanceReminder,
        );

        return back()->with('success', $attendanceReminder->is_active
            ? 'Reminder activated. It will keep repeating until you disable or delete it.'
            : 'Reminder deactivated. Future notifications are stopped.');
    }

    public function destroy(AttendanceReminder $attendanceReminder): RedirectResponse
    {
        $this->owns($attendanceReminder);
        $title = $attendanceReminder->title;
        $attendanceReminder->delete();
        $this->activityLog->log(
            'reminder_deleted',
            ActivityLogService::CATEGORY_ATTENDANCE,
            'Deleted personal attendance reminder '.$title,
            metadata: ['title' => $title],
        );

        return redirect()
            ->route('teacher.attendance-reminders.index')
            ->with('success', 'Reminder deleted. It will not send any further notifications.');
    }

    private function teacher(): Teacher
    {
        /** @var Teacher $teacher */
        $teacher = auth('teacher')->user();
        abort_unless($teacher->isAdministrator(), 403);

        return $teacher;
    }

    private function owns(AttendanceReminder $reminder): void
    {
        abort_unless((int) $reminder->teacher_id === (int) $this->teacher()->id, 403);
    }

    /**
     * @return array<string, mixed>
     */
    private function attributes(AttendanceReminderRequest $request): array
    {
        return [
            'title' => $request->validated('title'),
            'type' => $request->validated('type'),
            'trigger' => $request->validated('trigger'),
            'offset_minutes' => (int) $request->validated('offset_minutes'),
            'send_via' => $request->validated('send_via'),
            'message' => $request->validated('message'),
            'is_active' => $request->boolean('is_active'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formOptions(Teacher $teacher, ?AttendanceReminder $reminder): array
    {
        return [
            'reminder' => $reminder ? $this->detailPayload($reminder) : null,
            'schedules' => $this->reminders->assignedSchedules($teacher),
            'usage' => [
                'used' => $this->reminders->usage($teacher),
                'limit' => $this->reminders->limit(),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function listPayload(AttendanceReminder $reminder): array
    {
        return [
            'id' => $reminder->id,
            'title' => $reminder->title,
            'type' => $reminder->type,
            'type_label' => $reminder->typeLabel(),
            'days' => $reminder->days ?? [],
            'trigger_label' => $reminder->triggerLabel(),
            'offset_minutes' => $reminder->offset_minutes,
            'send_via' => $reminder->send_via,
            'send_via_label' => $reminder->sendViaLabel(),
            'is_active' => $reminder->is_active,
            'created_at' => $reminder->created_at?->format('M j, Y'),
            'next_occurrence' => $reminder->is_active ? $this->reminders->previewNext($reminder) : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function detailPayload(AttendanceReminder $reminder): array
    {
        $reminder->loadMissing('teacher');

        return [
            ...$this->listPayload($reminder),
            'trigger' => $reminder->trigger,
            'timetable_ids' => $selectedIds = $this->reminders->selectedTimetableIds($reminder),
            'schedules' => array_values(array_filter(
                $reminder->teacher ? $this->reminders->assignedSchedules($reminder->teacher) : [],
                fn (array $schedule) => in_array($schedule['id'], $selectedIds, true),
            )),
            'message' => $reminder->message,
        ];
    }

    private function log(string $event, string $description, AttendanceReminder $reminder): void
    {
        $this->activityLog->log($event, ActivityLogService::CATEGORY_ATTENDANCE, $description, metadata: [
            'reminder_id' => $reminder->id,
            'teacher_id' => $reminder->teacher_id,
            'title' => $reminder->title,
            'type' => $reminder->type,
        ]);
    }
}
