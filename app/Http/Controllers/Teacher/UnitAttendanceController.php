<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSelfReportedAbsenceReplyRequest;
use App\Models\StaffAttendance;
use App\Models\Teacher;
use App\Models\TeacherAttendance;
use App\Services\LeadershipScope;
use App\Services\SelfReportedAbsenceService;
use App\Support\AttendanceRecordSource;
use App\Support\SelfReportedAbsence;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class UnitAttendanceController extends Controller
{
    public function __construct(
        private LeadershipScope $leadershipScope,
        private SelfReportedAbsenceService $selfReportedAbsences,
    ) {}

    public function index(Request $request): Response
    {
        /** @var Teacher $leader */
        $leader = auth('teacher')->user();

        $from = $request->filled('date_from')
            ? Carbon::parse($request->date_from)->toDateString()
            : now()->subDays(30)->toDateString();
        $to = $request->filled('date_to')
            ? Carbon::parse($request->date_to)->toDateString()
            : now()->toDateString();

        $staffQuery = $this->leadershipScope->applyToTeachers(Teacher::query(), $leader);
        $staffIds = (clone $staffQuery)->pluck('id');

        if ($request->filled('teacher_id')) {
            $requestedId = (int) $request->teacher_id;
            abort_unless($staffIds->contains($requestedId), 403);
            $staffIds = collect([$requestedId]);
        }

        $lecturerRecords = TeacherAttendance::query()
            ->with(['teacher:id,first_name,last_name,title,employee_id,faculty_id,department_id,staff_type'])
            ->whereIn('teacher_id', $staffIds)
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->latest('date')
            ->limit(200)
            ->get()
            ->map(fn (TeacherAttendance $record) => [
                'id' => $record->id,
                'kind' => SelfReportedAbsence::KIND_LECTURER,
                'staff_name' => $record->teacher?->displayName(),
                'employee_id' => $record->teacher?->employee_id,
                'staff_type' => $record->teacher?->staff_type,
                'date' => Carbon::parse($record->date)->toDateString(),
                'status' => $record->status,
                'check_in' => $record->check_in_time,
                'check_out' => $record->check_out_time,
                'self_reported' => (bool) $record->self_reported,
                'source' => AttendanceRecordSource::label($record->attendance_source, (bool) $record->auto_generated),
                'reason' => $record->self_reported ? $record->self_reported_reason : null,
            ]);

        $administratorRecords = StaffAttendance::query()
            ->with(['staff:id,first_name,last_name,title,employee_id,faculty_id,department_id,staff_type'])
            ->whereIn('staff_id', $staffIds)
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->latest('date')
            ->limit(200)
            ->get()
            ->map(fn (StaffAttendance $record) => [
                'id' => $record->id,
                'kind' => SelfReportedAbsence::KIND_ADMINISTRATOR,
                'staff_name' => $record->staff?->displayName(),
                'employee_id' => $record->staff?->employee_id,
                'staff_type' => $record->staff?->staff_type,
                'date' => Carbon::parse($record->date)->toDateString(),
                'status' => $record->attendance_status,
                'check_in' => $record->check_in_time,
                'check_out' => $record->check_out_time,
                'self_reported' => (bool) $record->self_reported,
                'source' => AttendanceRecordSource::label($record->attendance_source, (bool) $record->auto_generated),
                'reason' => $record->self_reported ? $record->self_reported_reason : null,
            ]);

        $records = $lecturerRecords
            ->concat($administratorRecords)
            ->sortByDesc('date')
            ->values();

        return Inertia::render('teacher/unit/attendance', [
            'records' => $records,
            'staff' => $staffQuery->orderBy('first_name')->get(['id', 'first_name', 'last_name', 'title', 'employee_id', 'staff_type']),
            'filters' => [
                'date_from' => $from,
                'date_to' => $to,
                'teacher_id' => $request->teacher_id,
            ],
            'leadershipScope' => $this->leadershipScope->summary($leader),
        ]);
    }

    public function selfReportedIndex(Request $request): Response
    {
        /** @var Teacher $leader */
        $leader = auth('teacher')->user();
        $staffIds = $this->scopedStaffIds($leader, $request);

        $from = $request->filled('date_from')
            ? Carbon::parse($request->date_from)->toDateString()
            : now()->subDays(30)->toDateString();
        $to = $request->filled('date_to')
            ? Carbon::parse($request->date_to)->toDateString()
            : now()->toDateString();

        $lecturerRecords = TeacherAttendance::query()
            ->with(['teacher.faculty', 'teacher.department', 'timetable.course', 'classroom'])
            ->whereIn('teacher_id', $staffIds)
            ->where('self_reported', true)
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->latest('self_reported_at')
            ->limit(200)
            ->get()
            ->map(fn (TeacherAttendance $record) => $this->selfReportedAbsences->serializeForLeader($record, SelfReportedAbsence::KIND_LECTURER));

        $administratorRecords = StaffAttendance::query()
            ->with(['staff.faculty', 'staff.department', 'timetable', 'classroom'])
            ->whereIn('staff_id', $staffIds)
            ->where('self_reported', true)
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->latest('self_reported_at')
            ->limit(200)
            ->get()
            ->map(fn (StaffAttendance $record) => $this->selfReportedAbsences->serializeForLeader($record, SelfReportedAbsence::KIND_ADMINISTRATOR));

        return Inertia::render('teacher/unit/self-reported-absences', [
            'records' => $lecturerRecords->concat($administratorRecords)->sortByDesc('submitted_at')->values(),
            'staff' => $this->leadershipScope->applyToTeachers(Teacher::query(), $leader)
                ->orderBy('first_name')
                ->get(['id', 'first_name', 'last_name', 'title', 'employee_id', 'staff_type']),
            'filters' => [
                'date_from' => $from,
                'date_to' => $to,
                'teacher_id' => $request->teacher_id,
            ],
            'leadershipScope' => $this->leadershipScope->summary($leader),
        ]);
    }

    public function selfReportedShow(string $kind, int $attendance): Response
    {
        abort_unless(in_array($kind, [SelfReportedAbsence::KIND_LECTURER, SelfReportedAbsence::KIND_ADMINISTRATOR], true), 404);

        /** @var Teacher $leader */
        $leader = auth('teacher')->user();
        $record = $this->findSelfReportedRecord($kind, $attendance);
        $staff = $kind === SelfReportedAbsence::KIND_LECTURER ? $record->teacher : $record->staff;

        abort_unless($staff instanceof Teacher && $this->leadershipScope->canManage($leader, $staff), 403);

        return Inertia::render('teacher/unit/self-reported-absence-show', [
            'record' => $this->selfReportedAbsences->serializeForLeader($record, $kind, includeReplies: true),
            'leadershipScope' => $this->leadershipScope->summary($leader),
            'canReply' => true,
            'replyUrl' => route('teacher.unit.self-reported-absences.reply', [
                'kind' => $kind,
                'attendance' => $attendance,
            ]),
        ]);
    }

    public function selfReportedReply(
        StoreSelfReportedAbsenceReplyRequest $request,
        string $kind,
        int $attendance,
    ): RedirectResponse {
        abort_unless(in_array($kind, [SelfReportedAbsence::KIND_LECTURER, SelfReportedAbsence::KIND_ADMINISTRATOR], true), 404);

        /** @var Teacher $leader */
        $leader = auth('teacher')->user();
        $record = $this->findSelfReportedRecord($kind, $attendance);
        $staff = $kind === SelfReportedAbsence::KIND_LECTURER ? $record->teacher : $record->staff;

        abort_unless($staff instanceof Teacher && $this->leadershipScope->canManage($leader, $staff), 403);

        [, $notified] = $this->selfReportedAbsences->replyAsLeader(
            $leader,
            $record,
            $kind,
            $request->validated('body'),
        );

        return back()->with('success', $this->selfReportedAbsences->replySuccessMessage($notified));
    }

    public function ownerShow(string $kind, int $attendance): Response
    {
        abort_unless(in_array($kind, [SelfReportedAbsence::KIND_LECTURER, SelfReportedAbsence::KIND_ADMINISTRATOR], true), 404);

        /** @var Teacher $actor */
        $actor = auth('teacher')->user();
        $record = $this->findSelfReportedRecord($kind, $attendance);
        $staff = $kind === SelfReportedAbsence::KIND_LECTURER ? $record->teacher : $record->staff;

        abort_unless($staff instanceof Teacher && (int) $staff->id === (int) $actor->id, 403);

        return Inertia::render('teacher/unit/self-reported-absence-show', [
            'record' => $this->selfReportedAbsences->serializeForLeader($record, $kind, includeReplies: true),
            'leadershipScope' => null,
            'canReply' => false,
            'replyUrl' => null,
        ]);
    }

    /**
     * @return \Illuminate\Support\Collection<int, int>
     */
    private function scopedStaffIds(Teacher $leader, Request $request)
    {
        $staffQuery = $this->leadershipScope->applyToTeachers(Teacher::query(), $leader);
        $staffIds = (clone $staffQuery)->pluck('id');

        if ($request->filled('teacher_id')) {
            $requestedId = (int) $request->teacher_id;
            abort_unless($staffIds->contains($requestedId), 403);
            $staffIds = collect([$requestedId]);
        }

        return $staffIds;
    }

    private function findSelfReportedRecord(string $kind, int $attendance): TeacherAttendance|StaffAttendance
    {
        $record = $kind === SelfReportedAbsence::KIND_LECTURER
            ? TeacherAttendance::query()->with(['teacher.faculty', 'teacher.department', 'timetable.course', 'classroom'])->findOrFail($attendance)
            : StaffAttendance::query()->with(['staff.faculty', 'staff.department', 'timetable', 'classroom'])->findOrFail($attendance);

        abort_unless($record->self_reported, 404);

        return $record;
    }
}
