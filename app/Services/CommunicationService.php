<?php

namespace App\Services;

use App\Jobs\DeliverCommunicationJob;
use App\Models\Communication;
use App\Models\CommunicationRecipient;
use App\Models\CommunicationTarget;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\Teacher;
use App\Models\User;
use App\Support\CommunicationPermissions;
use App\Support\LecturerNotificationPayload;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class CommunicationService
{
    public const LARGE_AUDIENCE_THRESHOLD = 50;

    public function __construct(
        private readonly LeadershipScope $leadershipScope,
        private readonly LecturerNotificationService $notifications,
    ) {}

    public function canCompose(User|Teacher $actor): bool
    {
        if ($actor instanceof Teacher) {
            return $actor->hasLeadershipAssignment();
        }

        return $actor->can(CommunicationPermissions::COMPOSE);
    }

    public function canSend(User|Teacher $actor): bool
    {
        if ($actor instanceof Teacher) {
            return $actor->hasLeadershipAssignment();
        }

        return $actor->can(CommunicationPermissions::SEND);
    }

    public function canManageDrafts(User|Teacher $actor): bool
    {
        if ($actor instanceof Teacher) {
            return $actor->hasLeadershipAssignment();
        }

        return $actor->can(CommunicationPermissions::MANAGE_DRAFTS);
    }

    public function canViewSent(User|Teacher $actor): bool
    {
        if ($actor instanceof Teacher) {
            return $actor->hasLeadershipAssignment();
        }

        return $actor->can(CommunicationPermissions::VIEW)
            || $actor->can(CommunicationPermissions::VIEW_SENT);
    }

    public function canViewDetails(User|Teacher $actor): bool
    {
        if ($actor instanceof Teacher) {
            return true;
        }

        return $actor->can(CommunicationPermissions::VIEW)
            || $actor->can(CommunicationPermissions::VIEW_DETAILS);
    }

    /**
     * @return array<string, bool|string|null>
     */
    public function capabilities(User|Teacher $actor): array
    {
        if ($actor instanceof Teacher) {
            return [
                'can_compose' => $this->canCompose($actor),
                'can_send' => $this->canSend($actor),
                'can_manage_drafts' => $this->canManageDrafts($actor),
                'can_send_selected_faculties' => false,
                'can_send_all_faculties' => false,
                'can_send_selected_departments' => false,
                'can_send_all_departments' => false,
                'can_send_selected_staff' => $this->canCompose($actor),
                'can_send_all_staff' => $this->canCompose($actor),
                'scope_label' => $this->scopeLabel($actor),
                'all_staff_label' => $this->allStaffLabel($actor),
            ];
        }

        return [
            'can_compose' => $this->canCompose($actor),
            'can_send' => $this->canSend($actor),
            'can_manage_drafts' => $this->canManageDrafts($actor),
            'can_send_selected_faculties' => $actor->can(CommunicationPermissions::SEND_SELECTED_FACULTIES),
            'can_send_all_faculties' => $actor->can(CommunicationPermissions::SEND_ALL_FACULTIES),
            'can_send_selected_departments' => $actor->can(CommunicationPermissions::SEND_SELECTED_DEPARTMENTS),
            'can_send_all_departments' => $actor->can(CommunicationPermissions::SEND_ALL_DEPARTMENTS),
            'can_send_selected_staff' => $actor->can(CommunicationPermissions::SEND_SELECTED_STAFF),
            'can_send_all_staff' => $actor->can(CommunicationPermissions::SEND_ALL_STAFF),
            'scope_label' => 'Institution',
            'all_staff_label' => 'All staff',
        ];
    }

    public function scopeLabel(Teacher $leader): string
    {
        if ($leader->isDirectorDean()) {
            return $leader->leadershipFaculty?->name
                ? 'Directorate/Faculty: '.$leader->leadershipFaculty->name
                : 'Assigned Directorate/Faculty';
        }

        if ($leader->isHeadOfDepartment()) {
            return $leader->leadershipDepartment?->name
                ? 'Department: '.$leader->leadershipDepartment->name
                : 'Assigned department';
        }

        return 'Assigned unit';
    }

    public function allStaffLabel(Teacher $leader): string
    {
        if ($leader->isDirectorDean()) {
            $name = $leader->leadershipFaculty?->name;

            return $name
                ? 'All staff in '.$name
                : 'All staff in assigned Directorate/Faculty';
        }

        if ($leader->isHeadOfDepartment()) {
            $name = $leader->leadershipDepartment?->name;

            return $name
                ? 'All staff in '.$name
                : 'All staff in assigned department';
        }

        return 'All eligible staff';
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array{teacher_ids: list<int>, count: int, groups: list<string>, warning: string|null, large_audience: bool}
     */
    public function preview(User|Teacher $actor, array $input): array
    {
        $this->assertCanCompose($actor);
        $this->assertTargetPermissions($actor, $input);

        $teachers = $this->resolveTeachers($actor, $input);
        $count = $teachers->count();

        return [
            'teacher_ids' => $teachers->pluck('id')->all(),
            'count' => $count,
            'groups' => $this->audienceLabels($actor, $input),
            'warning' => $count >= self::LARGE_AUDIENCE_THRESHOLD
                ? "This message will reach {$count} staff members."
                : null,
            'large_audience' => $count >= self::LARGE_AUDIENCE_THRESHOLD,
        ];
    }

    /**
     * @param  array<string, mixed>  $input
     */
    public function save(User|Teacher $actor, array $input, bool $asDraft): Communication
    {
        $this->assertCanCompose($actor);

        if ($asDraft && ! $this->canManageDrafts($actor)) {
            abort(403, 'You are not authorized to manage drafts.');
        }

        if (! $asDraft && ! $this->canSend($actor)) {
            abort(403, 'You are not authorized to send messages.');
        }

        $this->assertTargetPermissions($actor, $input);

        $teachers = $this->resolveTeachers($actor, $input);

        if (! $asDraft && $teachers->isEmpty()) {
            throw ValidationException::withMessages([
                'recipients' => 'Select at least one valid recipient before sending.',
            ]);
        }

        $communication = Communication::create([
            'sender_type' => $actor::class,
            'sender_id' => $actor->getKey(),
            'subject' => trim((string) $input['subject']),
            'body' => trim((string) $input['body']),
            'status' => $asDraft ? Communication::STATUS_DRAFT : Communication::STATUS_SENDING,
            'recipient_count' => $teachers->count(),
            'delivered_count' => 0,
            'read_count' => 0,
            'audience_summary' => $this->audienceLabels($actor, $input),
            'sent_at' => $asDraft ? null : now(),
        ]);

        $this->storeTargets($communication, $actor, $input);

        if ($asDraft) {
            return $communication->fresh(['targets']) ?? $communication;
        }

        foreach ($teachers as $teacher) {
            CommunicationRecipient::firstOrCreate(
                [
                    'communication_id' => $communication->id,
                    'teacher_id' => $teacher->id,
                ],
                ['status' => CommunicationRecipient::STATUS_PENDING],
            );
        }

        $communication->update(['recipient_count' => $communication->recipients()->count()]);

        DeliverCommunicationJob::dispatch($communication->id);

        return $communication->fresh(['targets', 'recipients.teacher.faculty', 'recipients.teacher.department'])
            ?? $communication;
    }

    public function deliver(Communication $communication): void
    {
        if ($communication->isDraft()) {
            return;
        }

        $communication->loadMissing('recipients.teacher');

        $delivered = 0;
        $failed = 0;

        foreach ($communication->recipients as $recipient) {
            if (in_array($recipient->status, [CommunicationRecipient::STATUS_DELIVERED, CommunicationRecipient::STATUS_READ], true)) {
                $delivered++;

                continue;
            }

            $teacher = $recipient->teacher;

            if (! $teacher instanceof Teacher) {
                $recipient->update([
                    'status' => CommunicationRecipient::STATUS_FAILED,
                    'error_message' => 'Recipient is no longer available.',
                ]);
                $failed++;

                continue;
            }

            try {
                $this->notifications->notify($teacher, LecturerNotificationPayload::make(
                    type: 'communication_message',
                    category: LecturerNotificationPayload::CATEGORY_ADMINISTRATIVE,
                    priority: LecturerNotificationPayload::PRIORITY_MEDIUM,
                    title: $communication->subject,
                    message: $this->excerpt($communication->body),
                    url: route('teacher.communication.show', $communication, false),
                    meta: [
                        'communication_id' => $communication->id,
                        'sender_type' => class_basename($communication->sender_type),
                    ],
                ));

                $recipient->update([
                    'status' => CommunicationRecipient::STATUS_DELIVERED,
                    'delivered_at' => now(),
                    'error_message' => null,
                ]);
                $delivered++;
            } catch (\Throwable $e) {
                $recipient->update([
                    'status' => CommunicationRecipient::STATUS_FAILED,
                    'error_message' => $e->getMessage(),
                ]);
                $failed++;
            }
        }

        $status = Communication::STATUS_SENT;
        if ($failed > 0 && $delivered === 0) {
            $status = Communication::STATUS_FAILED;
        } elseif ($failed > 0) {
            $status = Communication::STATUS_PARTIAL;
        }

        $communication->update([
            'status' => $status,
            'delivered_count' => $delivered,
            'recipient_count' => $communication->recipients()->count(),
        ]);
    }

    /**
     * @return array<string, int>
     */
    public function dashboardStats(User|Teacher $actor): array
    {
        $query = $this->sentQuery($actor);

        return [
            'sent' => (clone $query)->whereIn('status', [
                Communication::STATUS_SENT,
                Communication::STATUS_PARTIAL,
                Communication::STATUS_SENDING,
            ])->count(),
            'recipients' => (int) (clone $query)->whereIn('status', [
                Communication::STATUS_SENT,
                Communication::STATUS_PARTIAL,
                Communication::STATUS_SENDING,
            ])->sum('recipient_count'),
            'drafts' => (clone $query)->where('status', Communication::STATUS_DRAFT)->count(),
            'delivered' => (int) (clone $query)->sum('delivered_count'),
            'read' => (int) (clone $query)->sum('read_count'),
        ];
    }

    /**
     * @return Collection<int, Communication>
     */
    public function recentSent(User|Teacher $actor, int $limit = 6): Collection
    {
        return $this->sentQuery($actor)
            ->with('targets')
            ->latest('id')
            ->limit($limit)
            ->get();
    }

    public function paginateSent(User|Teacher $actor, Request $request): LengthAwarePaginator
    {
        $query = $this->sentQuery($actor)->with('targets');

        $this->applyListFilters($query, $request);

        return $query
            ->latest('id')
            ->paginate(15)
            ->withQueryString();
    }

    public function paginateInbox(Teacher $teacher, Request $request): LengthAwarePaginator
    {
        $query = Communication::query()
            ->whereHas('recipients', fn (Builder $builder) => $builder->where('teacher_id', $teacher->id))
            ->with([
                'targets',
                'sender',
                'recipients' => fn ($builder) => $builder->where('teacher_id', $teacher->id),
            ]);

        $this->applyListFilters($query, $request, includeDrafts: false);

        return $query
            ->latest('sent_at')
            ->latest('id')
            ->paginate(15)
            ->withQueryString();
    }

    public function findForActor(User|Teacher $actor, Communication $communication): Communication
    {
        if (! $this->canView($actor, $communication)) {
            abort(403, 'You are not authorized to view this message.');
        }

        $communication->load([
            'targets',
            'sender',
            'recipients.teacher.faculty',
            'recipients.teacher.department',
        ]);

        if ($actor instanceof Teacher) {
            $this->markRead($actor, $communication);
            $communication->refresh()->load([
                'targets',
                'sender',
                'recipients.teacher.faculty',
                'recipients.teacher.department',
            ]);
        }

        return $communication;
    }

    public function canView(User|Teacher $actor, Communication $communication): bool
    {
        if ($this->isSender($actor, $communication)) {
            return $this->canViewDetails($actor) || $communication->isDraft();
        }

        if ($actor instanceof Teacher) {
            return $communication->recipients()
                ->where('teacher_id', $actor->id)
                ->exists();
        }

        return false;
    }

    public function markRead(Teacher $teacher, Communication $communication): void
    {
        $recipient = $communication->recipients()
            ->where('teacher_id', $teacher->id)
            ->first();

        if (! $recipient || $recipient->read_at) {
            return;
        }

        $recipient->update([
            'status' => CommunicationRecipient::STATUS_READ,
            'read_at' => now(),
            'delivered_at' => $recipient->delivered_at ?? now(),
        ]);

        $communication->update([
            'read_count' => $communication->recipients()
                ->whereNotNull('read_at')
                ->count(),
        ]);
    }

    /**
     * @return list<array{id: int, name: string}>
     */
    public function searchableFaculties(User $actor, ?string $search = null): array
    {
        $this->assertCanCompose($actor);

        return Faculty::query()
            ->when($search, fn (Builder $query) => $query->where('name', 'like', '%'.$search.'%'))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Faculty $faculty) => ['id' => $faculty->id, 'name' => $faculty->name])
            ->all();
    }

    /**
     * @return list<array{id: int, name: string, faculty_id: int, faculty_name: string|null}>
     */
    public function searchableDepartments(User $actor, ?string $search = null, ?int $facultyId = null): array
    {
        $this->assertCanCompose($actor);

        return Department::query()
            ->with('faculty:id,name')
            ->when($facultyId, fn (Builder $query) => $query->where('faculty_id', $facultyId))
            ->when($search, fn (Builder $query) => $query->where('name', 'like', '%'.$search.'%'))
            ->orderBy('name')
            ->get()
            ->map(fn (Department $department) => [
                'id' => $department->id,
                'name' => $department->name,
                'faculty_id' => $department->faculty_id,
                'faculty_name' => $department->faculty?->name,
            ])
            ->all();
    }

    /**
     * @return list<array{id: int, name: string, employee_id: string|null, faculty: string|null, department: string|null}>
     */
    public function searchableStaff(User|Teacher $actor, ?string $search = null, ?int $facultyId = null, ?int $departmentId = null): array
    {
        $this->assertCanCompose($actor);

        $query = Teacher::query()->with(['faculty:id,name', 'department:id,name']);

        if ($actor instanceof Teacher) {
            $this->leadershipScope->applyToTeachers($query, $actor);
            $query->where('id', '!=', $actor->id);
        } else {
            if ($facultyId) {
                $query->where('faculty_id', $facultyId);
            }

            if ($departmentId) {
                $query->where('department_id', $departmentId);
            }
        }

        $query->when($search, function (Builder $builder) use ($search) {
            $builder->where(function (Builder $inner) use ($search) {
                $inner->where('first_name', 'like', '%'.$search.'%')
                    ->orWhere('last_name', 'like', '%'.$search.'%')
                    ->orWhere('email', 'like', '%'.$search.'%')
                    ->orWhere('employee_id', 'like', '%'.$search.'%');
            });
        });

        return $query
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->limit(50)
            ->get()
            ->map(fn (Teacher $teacher) => [
                'id' => $teacher->id,
                'name' => $this->teacherLabel($teacher),
                'employee_id' => $teacher->employee_id,
                'faculty' => $teacher->faculty?->name,
                'department' => $teacher->department?->name,
            ])
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(Communication $communication, User|Teacher|null $actor = null): array
    {
        $isSender = $actor && $this->isSender($actor, $communication);
        $recipientRow = $actor instanceof Teacher
            ? $communication->recipients->firstWhere('teacher_id', $actor->id)
            : null;

        return [
            'id' => $communication->id,
            'subject' => $communication->subject,
            'body' => $communication->body,
            'status' => $communication->status,
            'status_label' => $communication->statusLabel(),
            'recipient_count' => $communication->recipient_count,
            'delivered_count' => $communication->delivered_count,
            'read_count' => $communication->read_count,
            'audience_summary' => $communication->audience_summary ?? [],
            'sent_at' => $communication->sent_at?->toIso8601String(),
            'created_at' => $communication->created_at?->toIso8601String(),
            'sender' => $this->serializeSender($communication->sender),
            'targets' => $communication->targets->map(fn (CommunicationTarget $target) => [
                'type' => $target->target_type,
                'id' => $target->target_id,
                'label' => $target->target_label,
            ])->values()->all(),
            'recipients' => $isSender && $communication->relationLoaded('recipients')
                ? $communication->recipients->map(fn (CommunicationRecipient $recipient) => [
                    'id' => $recipient->id,
                    'teacher_id' => $recipient->teacher_id,
                    'name' => $recipient->teacher ? $this->teacherLabel($recipient->teacher) : 'Staff',
                    'employee_id' => $recipient->teacher?->employee_id,
                    'faculty' => $recipient->teacher?->faculty?->name,
                    'department' => $recipient->teacher?->department?->name,
                    'status' => $recipient->status,
                    'status_label' => $recipient->statusLabel(),
                    'delivered_at' => $recipient->delivered_at?->toIso8601String(),
                    'read_at' => $recipient->read_at?->toIso8601String(),
                ])->values()->all()
                : [],
            'viewer_status' => $recipientRow?->status,
            'viewer_read_at' => $recipientRow?->read_at?->toIso8601String(),
        ];
    }

    public function teacherLabel(Teacher $teacher): string
    {
        $name = trim(implode(' ', array_filter([
            $teacher->title,
            $teacher->first_name,
            $teacher->last_name,
        ])));

        return $name !== '' ? $name : ($teacher->email ?: 'Staff');
    }

    /**
     * @param  array<string, mixed>  $input
     * @return Collection<int, Teacher>
     */
    private function resolveTeachers(User|Teacher $actor, array $input): Collection
    {
        if ($actor instanceof Teacher) {
            $query = Teacher::query();
            $this->leadershipScope->applyToTeachers($query, $actor);
            $query->where('id', '!=', $actor->id);

            $staffIds = $this->intIds($input['staff_ids'] ?? []);

            if (! empty($input['all_staff']) && $staffIds === []) {
                return $query->orderBy('id')->get();
            }

            if ($staffIds !== []) {
                $this->assertStaffInScope($actor, $staffIds);

                return $query->whereIn('id', $staffIds)->orderBy('id')->get();
            }

            return collect();
        }

        $ids = collect();

        if (! empty($input['all_faculties']) || ! empty($input['all_departments']) || ! empty($input['all_staff'])) {
            $ids = $ids->merge(Teacher::query()->pluck('id'));
        }

        $facultyIds = $this->intIds($input['faculty_ids'] ?? []);
        if ($facultyIds !== []) {
            $ids = $ids->merge(
                Teacher::query()->whereIn('faculty_id', $facultyIds)->pluck('id')
            );
        }

        $departmentIds = $this->intIds($input['department_ids'] ?? []);
        if ($departmentIds !== []) {
            $ids = $ids->merge(
                Teacher::query()->whereIn('department_id', $departmentIds)->pluck('id')
            );
        }

        $staffIds = $this->intIds($input['staff_ids'] ?? []);
        if ($staffIds !== []) {
            $ids = $ids->merge(
                Teacher::query()->whereIn('id', $staffIds)->pluck('id')
            );
        }

        $uniqueIds = $ids->unique()->filter()->values();

        if ($uniqueIds->isEmpty()) {
            return collect();
        }

        return Teacher::query()->whereIn('id', $uniqueIds)->orderBy('id')->get();
    }

    /**
     * @param  array<string, mixed>  $input
     */
    private function assertTargetPermissions(User|Teacher $actor, array $input): void
    {
        if (! $this->hasAnyTarget($input)) {
            throw ValidationException::withMessages([
                'recipients' => 'Select at least one recipient group.',
            ]);
        }

        if ($actor instanceof Teacher) {
            if (
                ! empty($input['all_faculties'])
                || ! empty($input['all_departments'])
                || $this->intIds($input['faculty_ids'] ?? []) !== []
                || $this->intIds($input['department_ids'] ?? []) !== []
            ) {
                abort(403, 'Leaders can only message staff within their assigned unit.');
            }

            $staffIds = $this->intIds($input['staff_ids'] ?? []);
            if ($staffIds !== []) {
                $this->assertStaffInScope($actor, $staffIds);
            }

            return;
        }

        $checks = [
            [! empty($input['all_faculties']), CommunicationPermissions::SEND_ALL_FACULTIES, 'all faculties/directorates'],
            [$this->intIds($input['faculty_ids'] ?? []) !== [], CommunicationPermissions::SEND_SELECTED_FACULTIES, 'selected faculties/directorates'],
            [! empty($input['all_departments']), CommunicationPermissions::SEND_ALL_DEPARTMENTS, 'all departments'],
            [$this->intIds($input['department_ids'] ?? []) !== [], CommunicationPermissions::SEND_SELECTED_DEPARTMENTS, 'selected departments'],
            [! empty($input['all_staff']), CommunicationPermissions::SEND_ALL_STAFF, 'all staff'],
            [$this->intIds($input['staff_ids'] ?? []) !== [], CommunicationPermissions::SEND_SELECTED_STAFF, 'selected staff'],
        ];

        foreach ($checks as [$used, $permission, $label]) {
            if ($used && ! $actor->can($permission)) {
                abort(403, "You are not authorized to send messages to {$label}.");
            }
        }
    }

    /**
     * @param  list<int>  $staffIds
     */
    private function assertStaffInScope(Teacher $actor, array $staffIds): void
    {
        $inScope = Teacher::query()
            ->whereIn('id', $staffIds);
        $this->leadershipScope->applyToTeachers($inScope, $actor);
        $allowed = $inScope->pluck('id')->all();

        if (count(array_unique($staffIds)) !== count($allowed)) {
            abort(403, 'One or more selected staff members are outside your assigned unit.');
        }
    }

    /**
     * @param  array<string, mixed>  $input
     */
    private function storeTargets(Communication $communication, User|Teacher $actor, array $input): void
    {
        $rows = [];

        if (! empty($input['all_faculties'])) {
            $rows[] = ['target_type' => CommunicationTarget::ALL_FACULTIES, 'target_id' => null, 'target_label' => 'All Faculties/Directorates'];
        }

        foreach (Faculty::query()->whereIn('id', $this->intIds($input['faculty_ids'] ?? []))->get() as $faculty) {
            $rows[] = ['target_type' => CommunicationTarget::FACULTY, 'target_id' => $faculty->id, 'target_label' => $faculty->name];
        }

        if (! empty($input['all_departments'])) {
            $rows[] = ['target_type' => CommunicationTarget::ALL_DEPARTMENTS, 'target_id' => null, 'target_label' => 'All Departments'];
        }

        foreach (Department::query()->whereIn('id', $this->intIds($input['department_ids'] ?? []))->get() as $department) {
            $rows[] = ['target_type' => CommunicationTarget::DEPARTMENT, 'target_id' => $department->id, 'target_label' => $department->name];
        }

        if (! empty($input['all_staff'])) {
            $rows[] = [
                'target_type' => CommunicationTarget::ALL_STAFF,
                'target_id' => null,
                'target_label' => $actor instanceof Teacher ? $this->allStaffLabel($actor) : 'All Staff',
            ];
        }

        foreach (Teacher::query()->whereIn('id', $this->intIds($input['staff_ids'] ?? []))->get() as $teacher) {
            $rows[] = ['target_type' => CommunicationTarget::STAFF, 'target_id' => $teacher->id, 'target_label' => $this->teacherLabel($teacher)];
        }

        foreach ($rows as $row) {
            $communication->targets()->create($row);
        }
    }

    /**
     * @param  array<string, mixed>  $input
     * @return list<string>
     */
    private function audienceLabels(User|Teacher $actor, array $input): array
    {
        $labels = [];

        if (! empty($input['all_faculties'])) {
            $labels[] = 'All Faculties/Directorates';
        }

        foreach (Faculty::query()->whereIn('id', $this->intIds($input['faculty_ids'] ?? []))->pluck('name') as $name) {
            $labels[] = 'Faculty/Directorate: '.$name;
        }

        if (! empty($input['all_departments'])) {
            $labels[] = 'All Departments';
        }

        foreach (Department::query()->whereIn('id', $this->intIds($input['department_ids'] ?? []))->pluck('name') as $name) {
            $labels[] = 'Department: '.$name;
        }

        if (! empty($input['all_staff'])) {
            $labels[] = $actor instanceof Teacher ? $this->allStaffLabel($actor) : 'All Staff';
        }

        $staffIds = $this->intIds($input['staff_ids'] ?? []);
        if ($staffIds !== []) {
            $labels[] = count($staffIds) === 1
                ? '1 selected staff member'
                : count($staffIds).' selected staff members';
        }

        return array_values(array_unique($labels));
    }

    /**
     * @param  array<string, mixed>  $input
     */
    private function hasAnyTarget(array $input): bool
    {
        return ! empty($input['all_faculties'])
            || ! empty($input['all_departments'])
            || ! empty($input['all_staff'])
            || $this->intIds($input['faculty_ids'] ?? []) !== []
            || $this->intIds($input['department_ids'] ?? []) !== []
            || $this->intIds($input['staff_ids'] ?? []) !== [];
    }

    /**
     * @param  mixed  $value
     * @return list<int>
     */
    private function intIds(mixed $value): array
    {
        return collect(is_array($value) ? $value : [])
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values()
            ->all();
    }

    private function assertCanCompose(User|Teacher $actor): void
    {
        if (! $this->canCompose($actor)) {
            abort(403, 'You are not authorized to compose messages.');
        }
    }

    private function sentQuery(User|Teacher $actor): Builder
    {
        return Communication::query()
            ->where('sender_type', $actor::class)
            ->where('sender_id', $actor->getKey());
    }

    private function applyListFilters(Builder $query, Request $request, bool $includeDrafts = true): void
    {
        $search = trim((string) $request->input('search', ''));
        if ($search !== '') {
            $query->where(function (Builder $builder) use ($search) {
                $builder->where('subject', 'like', '%'.$search.'%')
                    ->orWhere('body', 'like', '%'.$search.'%');
            });
        }

        $status = (string) $request->input('status', '');
        if ($status !== '' && in_array($status, Communication::STATUSES, true)) {
            $query->where('status', $status);
        } elseif (! $includeDrafts) {
            $query->where('status', '!=', Communication::STATUS_DRAFT);
        }

        $from = $request->input('from');
        if (is_string($from) && $from !== '') {
            $query->whereDate('sent_at', '>=', $from);
        }

        $to = $request->input('to');
        if (is_string($to) && $to !== '') {
            $query->whereDate('sent_at', '<=', $to);
        }

        $targetType = (string) $request->input('recipient_type', '');
        if ($targetType !== '') {
            $query->whereHas('targets', fn (Builder $builder) => $builder->where('target_type', $targetType));
        }
    }

    private function isSender(User|Teacher $actor, Communication $communication): bool
    {
        return $communication->sender_type === $actor::class
            && (int) $communication->sender_id === (int) $actor->getKey();
    }

    /**
     * @return array{type: string, name: string}|null
     */
    private function serializeSender(mixed $sender): ?array
    {
        if ($sender instanceof Teacher) {
            return [
                'type' => 'teacher',
                'name' => $this->teacherLabel($sender),
            ];
        }

        if ($sender instanceof User) {
            return [
                'type' => 'admin',
                'name' => $sender->name ?: $sender->email,
            ];
        }

        return null;
    }

    private function excerpt(string $body, int $limit = 180): string
    {
        $plain = trim(preg_replace('/\s+/', ' ', strip_tags($body)) ?? '');

        if (strlen($plain) <= $limit) {
            return $plain;
        }

        return rtrim(substr($plain, 0, $limit - 1)).'…';
    }
}
