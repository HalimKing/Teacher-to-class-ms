<?php

namespace App\Services;

use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Models\TimeTable;
use App\Models\User;
use App\Models\VenueChangeAuthorization;
use App\Models\VenueChangeRequest;
use App\Models\VenueChangeRequestApproval;
use App\Models\VenueChangeRequestItem;
use App\Notifications\AdminVenueChangeRequestSubmitted;
use App\Notifications\LeadershipVenueChangeRequestSubmitted;
use App\Support\LeadershipAssignment;
use App\Support\LecturerNotificationPayload;
use App\Support\VenueChangeApprovalRole;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use InvalidArgumentException;

class VenueChangeRequestService
{
    public function __construct(
        private ActivityLogService $activityLog,
        private LecturerNotificationService $notifications,
        private VenueChangeAuthorizationService $authorizationService,
        private LeadershipScope $leadershipScope,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     * @param  array<int, int>  $timetableIds
     */
    public function submit(Teacher $staff, array $data, array $timetableIds): VenueChangeRequest
    {
        if (!$staff->isAdministrator()) {
            throw new InvalidArgumentException('Only administrator staff can submit venue change requests.');
        }

        if (!SystemSetting::administratorVenueChangeRequestsEnabled()) {
            throw new InvalidArgumentException('Administrator venue change requests are currently disabled by system settings.');
        }

        $timetableIds = array_values(array_unique(array_map('intval', $timetableIds)));

        if ($timetableIds === []) {
            throw new InvalidArgumentException('Select at least one schedule.');
        }

        $startDate = (string) $data['start_date'];
        $endDate = (string) $data['end_date'];

        if (Carbon::parse($endDate)->lt(Carbon::parse($startDate))) {
            throw new InvalidArgumentException('End date cannot be earlier than start date.');
        }

        $authorizedClassroomId = (int) $data['authorized_classroom_id'];
        $authorizationType = (string) $data['authorization_type'];

        $schedules = TimeTable::query()
            ->with('classRoom')
            ->whereIn('id', $timetableIds)
            ->get();

        if ($schedules->count() !== count($timetableIds)) {
            throw new InvalidArgumentException('One or more selected schedules could not be found.');
        }

        foreach ($schedules as $schedule) {
            if ((int) $schedule->teacher_id !== (int) $staff->id) {
                throw new InvalidArgumentException("Schedule #{$schedule->id} does not belong to you.");
            }

            if ($schedule->staff_type !== Teacher::STAFF_TYPE_ADMINISTRATOR) {
                throw new InvalidArgumentException("Schedule #{$schedule->id} is not an administrator schedule.");
            }

            if (!$schedule->class_room_id) {
                throw new InvalidArgumentException("Schedule #{$schedule->id} has no assigned venue.");
            }

            if ((int) $schedule->class_room_id === $authorizedClassroomId) {
                throw new InvalidArgumentException(
                    "Replacement venue must differ from the original venue for schedule #{$schedule->id}."
                );
            }
        }

        $authConflicts = $this->authorizationService->findConflicts(
            (int) $staff->id,
            $startDate,
            $endDate,
            $timetableIds,
            $authorizationType,
        );

        if ($authConflicts->isNotEmpty()) {
            throw new InvalidArgumentException(
                'An active venue change authorization already covers one or more of the selected schedules for this period.'
            );
        }

        $pendingConflicts = $this->findPendingConflicts(
            (int) $staff->id,
            $startDate,
            $endDate,
            $timetableIds,
            $authorizationType,
        );

        if ($pendingConflicts->isNotEmpty()) {
            throw new InvalidArgumentException(
                'A pending venue change request already covers one or more of the selected schedules for this period.'
            );
        }

        return DB::transaction(function () use ($staff, $data, $schedules, $authorizedClassroomId, $authorizationType, $startDate, $endDate) {
            $request = VenueChangeRequest::create([
                'staff_id' => $staff->id,
                'faculty_id' => $staff->faculty_id,
                'department_id' => $staff->department_id,
                'authorized_classroom_id' => $authorizedClassroomId,
                'authorization_type' => $authorizationType,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'start_time' => $data['start_time'] ?? null,
                'end_time' => $data['end_time'] ?? null,
                'reason' => $data['reason'],
                'notes' => $data['notes'] ?? null,
                'status' => VenueChangeRequest::STATUS_PENDING,
            ]);

            foreach ($schedules as $schedule) {
                VenueChangeRequestItem::create([
                    'venue_change_request_id' => $request->id,
                    'timetable_id' => $schedule->id,
                    'original_classroom_id' => $schedule->class_room_id,
                ]);
            }

            $this->createRequiredApprovals($request, $staff);

            $this->activityLog->log(
                'venue_change_request_submitted',
                ActivityLogService::CATEGORY_ATTENDANCE,
                "Venue change request #{$request->id} submitted by administrator staff #{$staff->id} for {$request->period_label}.",
                metadata: [
                    'request_id' => $request->id,
                    'staff_id' => $staff->id,
                    'faculty_id' => $staff->faculty_id,
                    'department_id' => $staff->department_id,
                    'timetable_ids' => $schedules->pluck('id')->all(),
                    'authorized_classroom_id' => $authorizedClassroomId,
                    'authorization_type' => $authorizationType,
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'reason' => $request->reason,
                    'status' => VenueChangeRequest::STATUS_PENDING,
                    'required_approver_roles' => $request->approvals()->pluck('role')->all(),
                ],
            );

            $request->load(['staff.faculty', 'staff.department', 'authorizedClassroom', 'items.timetable', 'items.originalClassroom', 'approvals.assignedTeacher']);

            $this->notifyAdminsSubmitted($request);
            $this->notifyLeadershipSubmitted($request);

            return $request;
        });
    }

    public function approve(VenueChangeRequest $request, User $reviewer, ?string $comments = null): VenueChangeRequest
    {
        return $this->recordApproverDecision(
            $request,
            VenueChangeApprovalRole::ADMINISTRATOR,
            approved: true,
            comments: $comments,
            decidedBy: $reviewer,
        );
    }

    public function reject(VenueChangeRequest $request, User $reviewer, ?string $comments = null): VenueChangeRequest
    {
        return $this->recordApproverDecision(
            $request,
            VenueChangeApprovalRole::ADMINISTRATOR,
            approved: false,
            comments: $comments,
            decidedBy: $reviewer,
        );
    }

    public function recordLeadershipDecision(
        VenueChangeRequest $request,
        Teacher $leader,
        bool $approved,
        ?string $comments = null,
    ): VenueChangeRequest {
        $role = $this->approvalRoleForLeader($leader);

        if (!$role) {
            throw new InvalidArgumentException('You are not assigned as a Director/Dean or Head of Department.');
        }

        $request->loadMissing('staff');

        if (!$request->staff instanceof Teacher || !$this->canLeadershipReview($leader, $request)) {
            throw new InvalidArgumentException('You are not authorized to review this venue change request.');
        }

        return $this->recordApproverDecision($request, $role, $approved, $comments, $leader);
    }

    public function canLeadershipReview(Teacher $leader, VenueChangeRequest $request): bool
    {
        $request->loadMissing('staff');

        if ($request->staff instanceof Teacher && $this->leadershipScope->canManage($leader, $request->staff)) {
            return true;
        }

        if ($leader->isDirectorDean() && $leader->leadership_faculty_id) {
            return (int) $request->faculty_id === (int) $leader->leadership_faculty_id;
        }

        if ($leader->isHeadOfDepartment() && $leader->leadership_department_id) {
            return (int) $request->department_id === (int) $leader->leadership_department_id;
        }

        return false;
    }

    public function canLeadershipDecide(Teacher $leader, VenueChangeRequest $request): bool
    {
        if (!$request->isPending() || !$this->canLeadershipReview($leader, $request)) {
            return false;
        }

        $role = $this->approvalRoleForLeader($leader);
        $approval = $this->approvalForRole($request, $role);

        return $approval instanceof VenueChangeRequestApproval && $approval->isPending();
    }

    public function canAdministratorDecide(VenueChangeRequest $request): bool
    {
        if (!$request->isPending()) {
            return false;
        }

        $approval = $this->approvalForRole($request, VenueChangeApprovalRole::ADMINISTRATOR);

        return !$approval || $approval->isPending();
    }

    public function approvalRoleForLeader(Teacher $leader): ?string
    {
        if ($leader->isDirectorDean()) {
            return VenueChangeApprovalRole::DIRECTOR_DEAN;
        }

        if ($leader->isHeadOfDepartment()) {
            return VenueChangeApprovalRole::HEAD_OF_DEPARTMENT;
        }

        return null;
    }

    public function cancel(VenueChangeRequest $request, Teacher $staff): VenueChangeRequest
    {
        if ((int) $request->staff_id !== (int) $staff->id) {
            throw new InvalidArgumentException('You can only cancel your own venue change requests.');
        }

        if (!$request->isPending()) {
            throw new InvalidArgumentException('Only pending venue change requests can be cancelled.');
        }

        return DB::transaction(function () use ($request, $staff) {
            $locked = $this->lockRequest($request);

            $locked->approvals()
                ->where('status', VenueChangeRequestApproval::STATUS_PENDING)
                ->update([
                    'status' => VenueChangeRequestApproval::STATUS_REJECTED,
                    'comments' => 'Request cancelled by requester.',
                    'decided_at' => now(),
                ]);

            $locked->update([
                'status' => VenueChangeRequest::STATUS_REJECTED,
                'admin_comments' => 'Cancelled by requester before review.',
                'reviewed_at' => now(),
            ]);

            $this->activityLog->log(
                'venue_change_request_cancelled',
                ActivityLogService::CATEGORY_ATTENDANCE,
                "Venue change request #{$request->id} cancelled by requester staff #{$staff->id}.",
                metadata: [
                    'request_id' => $request->id,
                    'staff_id' => $staff->id,
                    'status' => VenueChangeRequest::STATUS_REJECTED,
                ],
            );

            return $this->freshRequest($locked);
        });
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function serializeApprovals(VenueChangeRequest $request): array
    {
        $request->loadMissing(['approvals.assignedTeacher', 'approvals.decidedBy']);

        return $request->approvals
            ->sortBy(fn (VenueChangeRequestApproval $approval) => match ($approval->role) {
                VenueChangeApprovalRole::DIRECTOR_DEAN => 0,
                VenueChangeApprovalRole::HEAD_OF_DEPARTMENT => 1,
                default => 2,
            })
            ->values()
            ->map(function (VenueChangeRequestApproval $approval) {
                return [
                    'id' => $approval->id,
                    'role' => $approval->role,
                    'role_label' => $approval->roleLabel(),
                    'status' => $approval->status,
                    'status_label' => $approval->statusLabel(),
                    'assigned_name' => $approval->assignedTeacher?->displayName(),
                    'decided_by_name' => $approval->decidedByName(),
                    'comments' => $approval->comments,
                    'decided_at' => $approval->decided_at?->toIso8601String(),
                    'decided_at_display' => $approval->decided_at?->timezone(config('app.timezone'))->format('M j, Y g:i A'),
                ];
            })
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeForLeader(VenueChangeRequest $request): array
    {
        $request->loadMissing([
            'staff.faculty',
            'staff.department',
            'authorizedClassroom',
            'faculty',
            'department',
            'items.timetable.course',
            'items.originalClassroom',
            'approvals.assignedTeacher',
            'approvals.decidedBy',
        ]);

        $staff = $request->staff;
        $originalVenues = $request->items
            ->map(fn (VenueChangeRequestItem $item) => $item->originalClassroom?->name)
            ->filter()
            ->unique()
            ->values();

        return [
            'id' => $request->id,
            'status' => $request->status,
            'status_label' => $request->status_label,
            'period_label' => $request->period_label,
            'reason' => $request->reason,
            'notes' => $request->notes,
            'authorization_type' => $request->authorization_type,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'created_at' => $request->created_at?->toIso8601String(),
            'created_at_display' => $request->created_at?->timezone(config('app.timezone'))->format('M j, Y g:i A'),
            'staff_id' => $request->staff_id,
            'staff_name' => $staff?->displayName(),
            'employee_id' => $staff?->employee_id,
            'staff_role' => $staff?->staffTypeLabel(),
            'faculty_name' => $request->faculty?->name ?? $staff?->faculty?->name,
            'department_name' => $request->department?->name ?? $staff?->department?->name,
            'current_venue' => $originalVenues->implode(', ') ?: '—',
            'requested_venue' => $request->authorizedClassroom?->name ?? '—',
            'schedule_count' => $request->items->count(),
            'session_label' => $this->sessionLabel($request),
            'approval_progress' => $this->approvalProgressLabel($request),
            'approvals' => $this->serializeApprovals($request),
            'resulting_authorization_id' => $request->resulting_authorization_id,
            'items' => $request->items->map(fn (VenueChangeRequestItem $item) => [
                'id' => $item->id,
                'timetable' => [
                    'day_of_week' => $item->timetable?->day_of_week,
                    'day' => $item->timetable?->day,
                    'start_time' => $item->timetable?->start_time,
                    'end_time' => $item->timetable?->end_time,
                    'course' => $item->timetable?->course ? [
                        'name' => $item->timetable->course->name,
                    ] : null,
                ],
                'original_classroom' => $item->originalClassroom ? [
                    'name' => $item->originalClassroom->name,
                ] : null,
            ])->all(),
        ];
    }

    /**
     * @param  array<int, int>  $timetableIds
     * @return Collection<int, VenueChangeRequest>
     */
    public function findPendingConflicts(
        int $staffId,
        string $startDate,
        string $endDate,
        array $timetableIds,
        string $authorizationType,
        ?int $exceptRequestId = null,
    ): Collection {
        return VenueChangeRequest::query()
            ->with('items')
            ->pending()
            ->where('staff_id', $staffId)
            ->when($exceptRequestId, fn ($q) => $q->where('id', '!=', $exceptRequestId))
            ->whereDate('start_date', '<=', $endDate)
            ->whereDate('end_date', '>=', $startDate)
            ->whereHas('items', fn ($q) => $q->whereIn('timetable_id', $timetableIds))
            ->get()
            ->filter(function (VenueChangeRequest $request) use ($authorizationType, $timetableIds) {
                if (!$this->typesOverlap($request->authorization_type, $authorizationType)) {
                    return false;
                }

                $overlap = $request->items->pluck('timetable_id')->intersect($timetableIds);

                return $overlap->isNotEmpty();
            })
            ->values();
    }

    private function recordApproverDecision(
        VenueChangeRequest $request,
        string $role,
        bool $approved,
        ?string $comments,
        User|Teacher $decidedBy,
    ): VenueChangeRequest {
        if (!$request->isPending()) {
            throw new InvalidArgumentException('Only pending venue change requests can be reviewed.');
        }

        return DB::transaction(function () use ($request, $role, $approved, $comments, $decidedBy) {
            $locked = $this->lockRequest($request);
            $this->ensureAdministratorApprovalRow($locked);

            $approval = VenueChangeRequestApproval::query()
                ->where('venue_change_request_id', $locked->id)
                ->where('role', $role)
                ->lockForUpdate()
                ->first();

            if (!$approval) {
                throw new InvalidArgumentException('Your approval is not required for this request.');
            }

            if (!$approval->isPending()) {
                throw new InvalidArgumentException('This approval has already been recorded.');
            }

            $approval->update([
                'status' => $approved
                    ? VenueChangeRequestApproval::STATUS_APPROVED
                    : VenueChangeRequestApproval::STATUS_REJECTED,
                'comments' => $comments,
                'decided_by_type' => $decidedBy::class,
                'decided_by_id' => $decidedBy->id,
                'decided_at' => now(),
            ]);

            if ($decidedBy instanceof User) {
                $locked->update([
                    'reviewed_by' => $decidedBy->id,
                    'admin_comments' => $comments,
                ]);
            }

            $this->activityLog->log(
                $approved ? 'venue_change_request_approver_approved' : 'venue_change_request_approver_rejected',
                ActivityLogService::CATEGORY_ATTENDANCE,
                "Venue change request #{$locked->id} {$role} ".($approved ? 'approved' : 'rejected').'.',
                metadata: [
                    'request_id' => $locked->id,
                    'staff_id' => $locked->staff_id,
                    'role' => $role,
                    'approved' => $approved,
                    'comments' => $comments,
                    'decided_by_type' => $decidedBy::class,
                    'decided_by_id' => $decidedBy->id,
                ],
            );

            if (!$approved) {
                return $this->finalizeRejection($locked, $comments);
            }

            $locked->load('approvals');

            if ($locked->approvals->every(fn (VenueChangeRequestApproval $row) => $row->isApproved())) {
                return $this->finalizeApproval($locked, $this->finalAdminReviewer($locked, $decidedBy), $locked->admin_comments);
            }

            return $this->freshRequest($locked);
        });
    }

    private function finalizeApproval(VenueChangeRequest $request, User $reviewer, ?string $comments): VenueChangeRequest
    {
        $request->loadMissing('items');

        $timetableIds = $request->items->pluck('timetable_id')->map(fn ($id) => (int) $id)->all();

        $created = $this->authorizationService->createBulk([
            'staff_id' => $request->staff_id,
            'authorized_classroom_id' => $request->authorized_classroom_id,
            'authorization_type' => $request->authorization_type,
            'start_date' => $request->start_date->toDateString(),
            'end_date' => $request->end_date->toDateString(),
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'reason' => $request->reason,
            'notes' => $request->notes,
            'source_request_id' => $request->id,
        ], $timetableIds, $reviewer);

        $first = $created->first();

        $request->update([
            'status' => VenueChangeRequest::STATUS_APPROVED,
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
            'admin_comments' => $comments,
            'resulting_bulk_group_id' => $first?->bulk_group_id,
            'resulting_authorization_id' => $first?->id,
        ]);

        $this->activityLog->log(
            'venue_change_request_approved',
            ActivityLogService::CATEGORY_ATTENDANCE,
            "Venue change request #{$request->id} fully approved; created {$created->count()} authorization(s).",
            metadata: [
                'request_id' => $request->id,
                'staff_id' => $request->staff_id,
                'reviewed_by' => $reviewer->id,
                'admin_comments' => $comments,
                'authorization_ids' => $created->pluck('id')->all(),
                'bulk_group_id' => $first?->bulk_group_id,
                'status' => VenueChangeRequest::STATUS_APPROVED,
            ],
        );

        $this->notifyStaffReviewed($request->fresh(['staff', 'authorizedClassroom']), approved: true);

        return $this->freshRequest($request);
    }

    private function finalizeRejection(VenueChangeRequest $request, ?string $comments): VenueChangeRequest
    {
        $request->approvals()
            ->where('status', VenueChangeRequestApproval::STATUS_PENDING)
            ->update([
                'status' => VenueChangeRequestApproval::STATUS_REJECTED,
                'comments' => 'Closed because another required approver rejected the request.',
                'decided_at' => now(),
            ]);

        $request->update([
            'status' => VenueChangeRequest::STATUS_REJECTED,
            'reviewed_at' => now(),
            'admin_comments' => $comments,
        ]);

        $this->activityLog->log(
            'venue_change_request_rejected',
            ActivityLogService::CATEGORY_ATTENDANCE,
            "Venue change request #{$request->id} rejected.",
            metadata: [
                'request_id' => $request->id,
                'staff_id' => $request->staff_id,
                'admin_comments' => $comments,
                'status' => VenueChangeRequest::STATUS_REJECTED,
            ],
        );

        $this->notifyStaffReviewed($request->fresh(['staff']), approved: false);

        return $this->freshRequest($request);
    }

    private function createRequiredApprovals(VenueChangeRequest $request, Teacher $staff): void
    {
        VenueChangeRequestApproval::create([
            'venue_change_request_id' => $request->id,
            'role' => VenueChangeApprovalRole::ADMINISTRATOR,
            'status' => VenueChangeRequestApproval::STATUS_PENDING,
        ]);

        foreach ($this->leadershipApproverTargets($staff) as $target) {
            $teacher = $target['teacher'];

            if (!$teacher instanceof Teacher || (int) $teacher->id === (int) $staff->id) {
                continue;
            }

            VenueChangeRequestApproval::create([
                'venue_change_request_id' => $request->id,
                'role' => $target['role'],
                'assigned_teacher_id' => $teacher->id,
                'status' => VenueChangeRequestApproval::STATUS_PENDING,
            ]);
        }
    }

    /**
     * @return list<array{role: string, teacher: ?Teacher}>
     */
    private function leadershipApproverTargets(Teacher $staff): array
    {
        $dean = $staff->faculty_id
            ? Teacher::query()
                ->where('leadership_role', LeadershipAssignment::DIRECTOR_DEAN)
                ->where('leadership_faculty_id', $staff->faculty_id)
                ->orderBy('id')
                ->first()
            : null;

        $hod = $staff->department_id
            ? Teacher::query()
                ->where('leadership_role', LeadershipAssignment::HEAD_OF_DEPARTMENT)
                ->where('leadership_department_id', $staff->department_id)
                ->orderBy('id')
                ->first()
            : null;

        return [
            ['role' => VenueChangeApprovalRole::DIRECTOR_DEAN, 'teacher' => $dean],
            ['role' => VenueChangeApprovalRole::HEAD_OF_DEPARTMENT, 'teacher' => $hod],
        ];
    }

    private function ensureAdministratorApprovalRow(VenueChangeRequest $request): void
    {
        if ($request->approvals()->exists()) {
            return;
        }

        VenueChangeRequestApproval::create([
            'venue_change_request_id' => $request->id,
            'role' => VenueChangeApprovalRole::ADMINISTRATOR,
            'status' => VenueChangeRequestApproval::STATUS_PENDING,
        ]);
    }

    private function approvalForRole(VenueChangeRequest $request, ?string $role): ?VenueChangeRequestApproval
    {
        if (!$role) {
            return null;
        }

        $request->loadMissing('approvals');

        return $request->approvals->firstWhere('role', $role);
    }

    private function lockRequest(VenueChangeRequest $request): VenueChangeRequest
    {
        $locked = VenueChangeRequest::query()->whereKey($request->id)->lockForUpdate()->first();

        if (!$locked instanceof VenueChangeRequest) {
            throw new InvalidArgumentException('Venue change request could not be found.');
        }

        if (!$locked->isPending()) {
            throw new InvalidArgumentException('Only pending venue change requests can be reviewed.');
        }

        return $locked;
    }

    private function finalAdminReviewer(VenueChangeRequest $request, User|Teacher $decidedBy): User
    {
        if ($decidedBy instanceof User) {
            return $decidedBy;
        }

        $reviewer = User::query()->find($request->reviewed_by);

        if ($reviewer instanceof User) {
            return $reviewer;
        }

        throw new InvalidArgumentException('Administrator approval is required before this request can be fully approved.');
    }

    private function approvalProgressLabel(VenueChangeRequest $request): string
    {
        $request->loadMissing('approvals');

        $total = $request->approvals->count();

        if ($total === 0) {
            return $request->status_label;
        }

        if ($request->status === VenueChangeRequest::STATUS_APPROVED) {
            return 'Fully approved';
        }

        if ($request->status === VenueChangeRequest::STATUS_REJECTED) {
            return 'Rejected';
        }

        $approved = $request->approvals->where('status', VenueChangeRequestApproval::STATUS_APPROVED)->count();

        return "{$approved} of {$total} approvals recorded";
    }

    private function sessionLabel(VenueChangeRequest $request): string
    {
        $request->loadMissing(['items.timetable.course', 'items.originalClassroom']);

        return $request->items
            ->map(function (VenueChangeRequestItem $item) {
                $course = $item->timetable?->course?->name ?: 'Work period';
                $day = $item->timetable?->day_of_week ?: $item->timetable?->day;
                $time = trim(($item->timetable?->start_time ?? '').'–'.($item->timetable?->end_time ?? ''), '–');

                return trim($course.($day ? " · {$day}" : '').($time ? " {$time}" : ''));
            })
            ->filter()
            ->implode('; ') ?: 'Attendance session';
    }

    private function freshRequest(VenueChangeRequest $request): VenueChangeRequest
    {
        return $request->fresh([
            'staff.faculty',
            'staff.department',
            'faculty',
            'department',
            'authorizedClassroom',
            'reviewer',
            'items.timetable.course',
            'items.originalClassroom',
            'resultingAuthorization',
            'resultingAuthorizations',
            'approvals.assignedTeacher',
            'approvals.decidedBy',
        ]);
    }

    private function typesOverlap(string $existing, string $incoming): bool
    {
        if ($existing === VenueChangeAuthorization::TYPE_BOTH || $incoming === VenueChangeAuthorization::TYPE_BOTH) {
            return true;
        }

        return $existing === $incoming;
    }

    private function notifyAdminsSubmitted(VenueChangeRequest $request): void
    {
        if (!filter_var(SystemSetting::getValue('notify_admin_venue_change_request_submitted', true), FILTER_VALIDATE_BOOLEAN)) {
            return;
        }

        $admins = User::query()
            ->permission('admin.venue-change-requests.manage')
            ->get();

        if ($admins->isEmpty()) {
            $admins = User::role('Super Admin')->get();
        }

        if ($admins->isEmpty()) {
            return;
        }

        Notification::send($admins, new AdminVenueChangeRequestSubmitted($request));
    }

    private function notifyLeadershipSubmitted(VenueChangeRequest $request): void
    {
        if (!filter_var(SystemSetting::getValue('notify_leadership_venue_change_request_submitted', true), FILTER_VALIDATE_BOOLEAN)) {
            return;
        }

        $request->loadMissing([
            'staff',
            'authorizedClassroom',
            'items.timetable.course',
            'items.originalClassroom',
            'approvals.assignedTeacher',
        ]);

        $details = [
            'staff_name' => $request->staff?->displayName() ?? 'A staff member',
            'current_venue' => $request->items
                ->map(fn (VenueChangeRequestItem $item) => $item->originalClassroom?->name)
                ->filter()
                ->unique()
                ->implode(', ') ?: 'current venue',
            'requested_venue' => $request->authorizedClassroom?->name ?? 'requested venue',
            'session_label' => $this->sessionLabel($request),
            'period_label' => $request->period_label,
            'reason' => $request->reason,
            'url' => '/teacher/unit/venue-change-requests/'.$request->id,
        ];

        $notifiedIds = [];

        foreach ($request->approvals as $approval) {
            if (!VenueChangeApprovalRole::isLeadership($approval->role)) {
                continue;
            }

            $supervisor = $approval->assignedTeacher;

            if (!$supervisor instanceof Teacher || (int) $supervisor->id === (int) $request->staff_id) {
                continue;
            }

            if (in_array((int) $supervisor->id, $notifiedIds, true)) {
                continue;
            }

            try {
                $supervisor->notify(new LeadershipVenueChangeRequestSubmitted($request, [
                    ...$details,
                    'supervisor_role' => $approval->roleLabel(),
                ]));

                $notifiedIds[] = (int) $supervisor->id;
            } catch (\Throwable $exception) {
                Log::error('Failed to notify leadership of a venue change request.', [
                    'request_id' => $request->id,
                    'supervisor_id' => $supervisor->id,
                    'role' => $approval->role,
                    'error' => $exception->getMessage(),
                ]);
            }
        }
    }

    private function notifyStaffReviewed(VenueChangeRequest $request, bool $approved): void
    {
        $settingKey = $approved
            ? 'notify_venue_change_request_approved'
            : 'notify_venue_change_request_rejected';

        if (!filter_var(SystemSetting::getValue($settingKey, true), FILTER_VALIDATE_BOOLEAN)) {
            return;
        }

        $staff = $request->staff;
        if (!$staff instanceof Teacher) {
            return;
        }

        $venue = $request->authorizedClassroom?->name ?? 'requested venue';
        $period = $request->period_label;

        $this->notifications->notify($staff, LecturerNotificationPayload::make(
            type: $approved ? 'venue_change_request_approved' : 'venue_change_request_rejected',
            category: LecturerNotificationPayload::CATEGORY_ADMINISTRATIVE,
            priority: LecturerNotificationPayload::PRIORITY_HIGH,
            title: $approved ? 'Venue Change Request Approved' : 'Venue Change Request Rejected',
            message: $approved
                ? "Your venue change request was approved. You may mark attendance at {$venue} from {$period}."
                : 'Your venue change request was rejected.'.($request->admin_comments ? ' Feedback: '.$request->admin_comments : ''),
            url: '/teacher/venue-change-requests/'.$request->id,
            meta: [
                'request_id' => $request->id,
                'status' => $request->status,
                'authorized_classroom_id' => $request->authorized_classroom_id,
                'start_date' => $request->start_date?->toDateString(),
                'end_date' => $request->end_date?->toDateString(),
                'period_label' => $period,
            ],
        ));
    }
}
