<?php

namespace App\Services;

use App\Jobs\DeliverCommunicationJob;
use App\Models\Communication;
use App\Models\CommunicationConversation;
use App\Models\CommunicationConversationParticipant;
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
            return true;
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

        $subject = trim((string) $input['subject']);
        $body = trim((string) $input['body']);

        $conversation = CommunicationConversation::create([
            'subject' => $subject,
            'started_by_type' => $actor::class,
            'started_by_id' => $actor->getKey(),
            'message_count' => 0,
            'last_message_preview' => $this->excerpt($body),
            'last_message_at' => now(),
        ]);

        $this->addParticipant($conversation, $actor, markRead: true);

        $communication = Communication::create([
            'conversation_id' => $conversation->id,
            'parent_id' => null,
            'kind' => Communication::KIND_ORIGINAL,
            'sender_type' => $actor::class,
            'sender_id' => $actor->getKey(),
            'subject' => $subject,
            'body' => $body,
            'status' => $asDraft ? Communication::STATUS_DRAFT : Communication::STATUS_SENDING,
            'recipient_count' => $teachers->count(),
            'delivered_count' => 0,
            'read_count' => 0,
            'audience_summary' => $this->audienceLabels($actor, $input),
            'sent_at' => $asDraft ? null : now(),
        ]);

        $this->storeTargets($communication, $actor, $input);

        if ($asDraft) {
            $this->refreshConversation($conversation);

            return $communication->fresh(['targets', 'conversation']) ?? $communication;
        }

        foreach ($teachers as $teacher) {
            $this->addParticipant($conversation, $teacher);
            $this->addTeacherRecipient($communication, $teacher);
        }

        $communication->update(['recipient_count' => $communication->recipients()->count()]);
        $this->refreshConversation($conversation);

        DeliverCommunicationJob::dispatch($communication->id);

        return $communication->fresh(['targets', 'conversation', 'recipients.teacher.faculty', 'recipients.teacher.department'])
            ?? $communication;
    }

    public function sendDraft(User|Teacher $actor, Communication $communication): Communication
    {
        if (! $this->isSender($actor, $communication)) {
            abort(403, 'You can only send drafts that you created.');
        }

        if (! $communication->isDraft()) {
            throw ValidationException::withMessages([
                'status' => 'Only draft messages can be sent.',
            ]);
        }

        if (! $this->canSend($actor)) {
            abort(403, 'You are not authorized to send messages.');
        }

        $input = $this->inputFromTargets($communication);
        $this->assertTargetPermissions($actor, $input);
        $teachers = $this->resolveTeachers($actor, $input);

        if ($teachers->isEmpty()) {
            throw ValidationException::withMessages([
                'recipients' => 'This draft has no valid recipients. Update the audience before sending.',
            ]);
        }

        $communication->update([
            'status' => Communication::STATUS_SENDING,
            'sent_at' => now(),
            'audience_summary' => $this->audienceLabels($actor, $input),
        ]);

        $conversation = $this->ensureConversation($communication, $actor);

        foreach ($teachers as $teacher) {
            $this->addParticipant($conversation, $teacher);
            $this->addTeacherRecipient($communication, $teacher);
        }

        $communication->update(['recipient_count' => $communication->recipients()->count()]);
        $this->refreshConversation($conversation);

        DeliverCommunicationJob::dispatch($communication->id);

        return $communication->fresh(['targets', 'conversation', 'recipients.teacher.faculty', 'recipients.teacher.department'])
            ?? $communication;
    }

    public function deliver(Communication $communication): void
    {
        if ($communication->isDraft()) {
            return;
        }

        $communication->loadMissing(['recipients.teacher', 'recipients.user', 'conversation']);

        $delivered = 0;
        $failed = 0;
        $threadUrl = $communication->conversation_id
            ? route('teacher.communication.thread', $communication->conversation_id, false)
            : route('teacher.communication.show', $communication, false);

        foreach ($communication->recipients as $recipient) {
            if (in_array($recipient->status, [CommunicationRecipient::STATUS_DELIVERED, CommunicationRecipient::STATUS_READ], true)) {
                $delivered++;

                continue;
            }

            if ($recipient->user_id && ! $recipient->teacher_id) {
                $recipient->update([
                    'status' => CommunicationRecipient::STATUS_DELIVERED,
                    'delivered_at' => now(),
                    'error_message' => null,
                ]);
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
                    url: $threadUrl,
                    meta: [
                        'communication_id' => $communication->id,
                        'conversation_id' => $communication->conversation_id,
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

        if ($communication->conversation) {
            $this->refreshConversation($communication->conversation);
        }
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
            'conversation',
            'parent.sender',
            'recipients.teacher.faculty',
            'recipients.teacher.department',
            'recipients.user',
        ]);

        $this->markRead($actor, $communication);
        $communication->refresh()->load([
            'targets',
            'sender',
            'conversation',
            'parent.sender',
            'recipients.teacher.faculty',
            'recipients.teacher.department',
            'recipients.user',
        ]);

        return $communication;
    }

    public function canView(User|Teacher $actor, Communication $communication): bool
    {
        if ($this->isSender($actor, $communication)) {
            return $this->canViewDetails($actor) || $communication->isDraft();
        }

        if ($communication->conversation_id && $this->isParticipant($actor, $communication->conversation ?? $communication->conversation()->first())) {
            return true;
        }

        return $this->recipientQuery($communication->recipients(), $actor)->exists();
    }

    public function markRead(User|Teacher $actor, Communication $communication): void
    {
        $recipient = $this->recipientQuery($communication->recipients(), $actor)->first();

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
        $recipientRow = $communication->relationLoaded('recipients')
            ? $communication->recipients->first(function (CommunicationRecipient $recipient) use ($actor) {
                if (! $actor) {
                    return false;
                }

                return $actor instanceof Teacher
                    ? (int) $recipient->teacher_id === (int) $actor->id
                    : (int) $recipient->user_id === (int) $actor->id;
            })
            : null;

        return [
            'id' => $communication->id,
            'conversation_id' => $communication->conversation_id,
            'parent_id' => $communication->parent_id,
            'kind' => $communication->kind ?: Communication::KIND_ORIGINAL,
            'subject' => $communication->subject,
            'body' => $communication->body,
            'excerpt' => $this->excerpt($communication->body, 140),
            'status' => $communication->status,
            'status_label' => $communication->statusLabel(),
            'recipient_count' => $communication->recipient_count,
            'delivered_count' => $communication->delivered_count,
            'read_count' => $communication->read_count,
            'audience_summary' => $communication->audience_summary ?? [],
            'sent_at' => $communication->sent_at?->toIso8601String(),
            'created_at' => $communication->created_at?->toIso8601String(),
            'sender' => $this->serializeActor($communication->sender),
            'in_reply_to' => $communication->parent
                ? [
                    'id' => $communication->parent->id,
                    'sender' => $this->serializeActor($communication->parent->sender),
                    'excerpt' => $this->excerpt((string) $communication->parent->body, 140),
                ]
                : null,
            'to' => $communication->relationLoaded('recipients')
                ? $communication->recipients->map(fn (CommunicationRecipient $recipient) => [
                    'name' => $this->recipientName($recipient),
                    'type' => $recipient->teacher_id ? 'teacher' : 'admin',
                ])->values()->all()
                : [],
            'targets' => $communication->relationLoaded('targets')
                ? $communication->targets->map(fn (CommunicationTarget $target) => [
                    'type' => $target->target_type,
                    'id' => $target->target_id,
                    'label' => $target->target_label,
                ])->values()->all()
                : [],
            'recipients' => $isSender && $communication->relationLoaded('recipients')
                ? $communication->recipients->map(fn (CommunicationRecipient $recipient) => [
                    'id' => $recipient->id,
                    'teacher_id' => $recipient->teacher_id,
                    'user_id' => $recipient->user_id,
                    'name' => $this->recipientName($recipient),
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
     * @return array<string, mixed>
     */
    public function folderPayload(User|Teacher $actor, string $folder, Request $request): array
    {
        $conversations = $this->paginateConversations($actor, $folder, $request);
        $conversations->getCollection()->transform(
            fn (CommunicationConversation $conversation) => $this->serializeConversation($conversation, $actor)
        );

        return [
            'conversations' => $conversations,
            'folder' => $folder,
            'filters' => $request->only(['search', 'from', 'to', 'unread']),
            'capabilities' => $this->capabilities($actor),
            'counts' => $this->folderCounts($actor),
        ];
    }

    public function paginateConversations(User|Teacher $actor, string $folder, Request $request): LengthAwarePaginator
    {
        $query = CommunicationConversation::query()
            ->whereHas('participants', fn (Builder $builder) => $this->whereParticipantActor($builder, $actor))
            ->with([
                'startedBy',
                'latestMessage.sender',
                'participants.participant',
            ])
            ->withCount([
                'messages as unread_messages_count' => function (Builder $builder) use ($actor) {
                    $builder->where('status', '!=', Communication::STATUS_DRAFT)
                        ->whereHas('recipients', function (Builder $recipients) use ($actor) {
                            $this->whereRecipientActor($recipients, $actor)->whereNull('read_at');
                        });
                },
            ]);

        match ($folder) {
            'inbox' => $query->whereHas('messages', function (Builder $builder) use ($actor) {
                $builder->where('status', '!=', Communication::STATUS_DRAFT)
                    ->whereHas('recipients', fn (Builder $recipients) => $this->whereRecipientActor($recipients, $actor));
            }),
            'sent' => $query->whereHas('messages', function (Builder $builder) use ($actor) {
                $builder->where('sender_type', $actor::class)
                    ->where('sender_id', $actor->getKey())
                    ->where('status', '!=', Communication::STATUS_DRAFT);
            }),
            'drafts' => $query->whereHas('messages', function (Builder $builder) use ($actor) {
                $builder->where('sender_type', $actor::class)
                    ->where('sender_id', $actor->getKey())
                    ->where('status', Communication::STATUS_DRAFT);
            }),
            default => $query->where(function (Builder $builder) use ($actor) {
                $builder->whereHas('messages', fn (Builder $messages) => $messages->where('status', '!=', Communication::STATUS_DRAFT))
                    ->orWhereHas('messages', function (Builder $messages) use ($actor) {
                        $messages->where('status', Communication::STATUS_DRAFT)
                            ->where('sender_type', $actor::class)
                            ->where('sender_id', $actor->getKey());
                    });
            }),
        };

        $this->applyConversationFilters($query, $request, $actor);

        return $query
            ->orderByDesc('last_message_at')
            ->orderByDesc('id')
            ->paginate(20)
            ->withQueryString();
    }

    /**
     * @return array{inbox: int, drafts: int, sent: int, all: int}
     */
    public function folderCounts(User|Teacher $actor): array
    {
        return [
            'inbox' => $this->unreadConversationCount($actor),
            'drafts' => $this->conversationFolderQuery($actor, 'drafts')->count(),
            'sent' => $this->conversationFolderQuery($actor, 'sent')->count(),
            'all' => $this->conversationFolderQuery($actor, 'all')->count(),
        ];
    }

    public function unreadConversationCount(User|Teacher $actor): int
    {
        return CommunicationConversation::query()
            ->whereHas('participants', fn (Builder $builder) => $this->whereParticipantActor($builder, $actor))
            ->whereHas('messages', function (Builder $builder) use ($actor) {
                $builder->where('status', '!=', Communication::STATUS_DRAFT)
                    ->whereHas('recipients', function (Builder $recipients) use ($actor) {
                        $this->whereRecipientActor($recipients, $actor)->whereNull('read_at');
                    });
            })
            ->count();
    }

    public function findConversationForActor(User|Teacher $actor, CommunicationConversation $conversation): CommunicationConversation
    {
        if (! $this->canAccessConversation($actor, $conversation)) {
            abort(403, 'You are not authorized to view this conversation.');
        }

        $this->loadConversation($conversation);
        $this->markConversationRead($actor, $conversation);
        $conversation->refresh();
        $this->loadConversation($conversation);

        return $conversation;
    }

    public function canAccessConversation(User|Teacher $actor, CommunicationConversation $conversation): bool
    {
        return $this->isParticipant($actor, $conversation);
    }

    /**
     * @param  array{parent_id: int, mode: string, body: string}  $input
     */
    public function reply(User|Teacher $actor, CommunicationConversation $conversation, array $input): Communication
    {
        if (! $this->canAccessConversation($actor, $conversation)) {
            abort(403, 'You are not authorized to reply to this conversation.');
        }

        $parent = Communication::query()
            ->where('conversation_id', $conversation->id)
            ->where('id', $input['parent_id'])
            ->first();

        if (! $parent instanceof Communication || $parent->isDraft()) {
            abort(404, 'The message you are replying to was not found in this conversation.');
        }

        if (! $this->canView($actor, $parent)) {
            abort(403, 'You are not authorized to reply to this message.');
        }

        $mode = $input['mode'] === 'reply_all' ? 'reply_all' : 'reply';
        [$teachers, $users] = $this->resolveReplyRecipients($actor, $conversation, $parent, $mode);

        if ($teachers->isEmpty() && $users->isEmpty()) {
            throw ValidationException::withMessages([
                'body' => 'There is no recipient available for this reply.',
            ]);
        }

        $labels = $mode === 'reply_all' ? ['Reply all'] : ['Reply'];
        $communication = Communication::create([
            'conversation_id' => $conversation->id,
            'parent_id' => $parent->id,
            'kind' => $mode === 'reply_all' ? Communication::KIND_REPLY_ALL : Communication::KIND_REPLY,
            'sender_type' => $actor::class,
            'sender_id' => $actor->getKey(),
            'subject' => $conversation->subject,
            'body' => $input['body'],
            'status' => Communication::STATUS_SENDING,
            'recipient_count' => $teachers->count() + $users->count(),
            'delivered_count' => 0,
            'read_count' => 0,
            'audience_summary' => $labels,
            'sent_at' => now(),
        ]);

        $this->addParticipant($conversation, $actor, markRead: true);

        foreach ($teachers as $teacher) {
            $this->addParticipant($conversation, $teacher);
            $this->addTeacherRecipient($communication, $teacher);
            $communication->targets()->create([
                'target_type' => CommunicationTarget::STAFF,
                'target_id' => $teacher->id,
                'target_label' => $this->teacherLabel($teacher),
            ]);
        }

        foreach ($users as $user) {
            $this->addParticipant($conversation, $user);
            $this->addUserRecipient($communication, $user);
        }

        $communication->update(['recipient_count' => $communication->recipients()->count()]);
        $this->refreshConversation($conversation);

        DeliverCommunicationJob::dispatch($communication->id);

        return $communication->fresh(['conversation', 'recipients.teacher', 'recipients.user']) ?? $communication;
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeConversation(CommunicationConversation $conversation, User|Teacher $actor): array
    {
        $conversation->loadMissing(['startedBy', 'latestMessage.sender', 'participants.participant']);

        $latest = $conversation->latestMessage;
        $unread = isset($conversation->unread_messages_count)
            ? (int) $conversation->unread_messages_count > 0
            : $conversation->messages()
                ->where('status', '!=', Communication::STATUS_DRAFT)
                ->whereHas('recipients', function (Builder $recipients) use ($actor) {
                    $this->whereRecipientActor($recipients, $actor)->whereNull('read_at');
                })
                ->exists();

        $participants = $conversation->participants
            ->map(fn (CommunicationConversationParticipant $row) => $this->serializeActor($row->participant))
            ->filter()
            ->values()
            ->all();

        $from = $latest ? $this->serializeActor($latest->sender) : $this->serializeActor($conversation->startedBy);

        return [
            'id' => $conversation->id,
            'subject' => $conversation->subject,
            'preview' => $conversation->last_message_preview ?: ($latest ? $this->excerpt((string) $latest->body) : null),
            'last_message_at' => $conversation->last_message_at?->toIso8601String()
                ?? $latest?->sent_at?->toIso8601String()
                ?? $conversation->updated_at?->toIso8601String(),
            'message_count' => (int) $conversation->message_count,
            'unread' => (bool) $unread,
            'is_important' => $conversation->started_by_type === User::class,
            'has_draft' => $latest?->status === Communication::STATUS_DRAFT,
            'participants' => $participants,
            'from' => $from,
            'participant_label' => $this->participantLabel($participants, $actor, $from),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeThread(CommunicationConversation $conversation, User|Teacher $actor): array
    {
        $this->loadConversation($conversation);

        $messages = $conversation->messages
            ->sortBy('id')
            ->values()
            ->map(fn (Communication $message) => $this->serialize($message, $actor))
            ->all();

        $participants = $conversation->participants
            ->map(fn (CommunicationConversationParticipant $row) => $this->serializeActor($row->participant))
            ->filter()
            ->values()
            ->all();

        $draft = $conversation->messages->first(
            fn (Communication $message) => $message->isDraft() && $this->isSender($actor, $message)
        );

        $canReply = $conversation->messages->contains(
            fn (Communication $message) => $message->status !== Communication::STATUS_DRAFT
        );

        return [
            'id' => $conversation->id,
            'subject' => $conversation->subject,
            'message_count' => (int) $conversation->message_count,
            'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            'participants' => $participants,
            'can_reply' => $canReply,
            'can_reply_all' => $canReply && count($participants) > 2,
            'can_send_draft' => $draft instanceof Communication && $this->canSend($actor),
            'draft_id' => $draft?->id,
            'viewer' => $this->serializeActor($actor),
            'messages' => $messages,
        ];
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
     * @return array<string, mixed>
     */
    private function inputFromTargets(Communication $communication): array
    {
        $communication->loadMissing('targets');

        $input = [
            'all_faculties' => false,
            'all_departments' => false,
            'all_staff' => false,
            'faculty_ids' => [],
            'department_ids' => [],
            'staff_ids' => [],
        ];

        foreach ($communication->targets as $target) {
            match ($target->target_type) {
                CommunicationTarget::ALL_FACULTIES => $input['all_faculties'] = true,
                CommunicationTarget::ALL_DEPARTMENTS => $input['all_departments'] = true,
                CommunicationTarget::ALL_STAFF => $input['all_staff'] = true,
                CommunicationTarget::FACULTY => $input['faculty_ids'][] = (int) $target->target_id,
                CommunicationTarget::DEPARTMENT => $input['department_ids'][] = (int) $target->target_id,
                CommunicationTarget::STAFF => $input['staff_ids'][] = (int) $target->target_id,
                default => null,
            };
        }

        return $input;
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

    private function conversationFolderQuery(User|Teacher $actor, string $folder): Builder
    {
        $query = CommunicationConversation::query()
            ->whereHas('participants', fn (Builder $builder) => $this->whereParticipantActor($builder, $actor));

        return match ($folder) {
            'inbox' => $query->whereHas('messages', function (Builder $builder) use ($actor) {
                $builder->where('status', '!=', Communication::STATUS_DRAFT)
                    ->whereHas('recipients', fn (Builder $recipients) => $this->whereRecipientActor($recipients, $actor));
            }),
            'sent' => $query->whereHas('messages', function (Builder $builder) use ($actor) {
                $builder->where('sender_type', $actor::class)
                    ->where('sender_id', $actor->getKey())
                    ->where('status', '!=', Communication::STATUS_DRAFT);
            }),
            'drafts' => $query->whereHas('messages', function (Builder $builder) use ($actor) {
                $builder->where('sender_type', $actor::class)
                    ->where('sender_id', $actor->getKey())
                    ->where('status', Communication::STATUS_DRAFT);
            }),
            default => $query->where(function (Builder $builder) use ($actor) {
                $builder->whereHas('messages', fn (Builder $messages) => $messages->where('status', '!=', Communication::STATUS_DRAFT))
                    ->orWhereHas('messages', function (Builder $messages) use ($actor) {
                        $messages->where('status', Communication::STATUS_DRAFT)
                            ->where('sender_type', $actor::class)
                            ->where('sender_id', $actor->getKey());
                    });
            }),
        };
    }

    private function applyConversationFilters(Builder $query, Request $request, User|Teacher $actor): void
    {
        $search = trim((string) $request->input('search', ''));
        if ($search !== '') {
            $query->where(function (Builder $builder) use ($search) {
                $builder->where('subject', 'like', '%'.$search.'%')
                    ->orWhere('last_message_preview', 'like', '%'.$search.'%')
                    ->orWhereHas('messages', function (Builder $messages) use ($search) {
                        $messages->where('subject', 'like', '%'.$search.'%')
                            ->orWhere('body', 'like', '%'.$search.'%');
                    })
                    ->orWhereHas('participants', function (Builder $participants) use ($search) {
                        $teacherIds = Teacher::query()
                            ->where(function (Builder $inner) use ($search) {
                                $inner->where('first_name', 'like', '%'.$search.'%')
                                    ->orWhere('last_name', 'like', '%'.$search.'%')
                                    ->orWhere('email', 'like', '%'.$search.'%');
                            })
                            ->pluck('id');
                        $userIds = User::query()
                            ->where(function (Builder $inner) use ($search) {
                                $inner->where('name', 'like', '%'.$search.'%')
                                    ->orWhere('email', 'like', '%'.$search.'%');
                            })
                            ->pluck('id');

                        $participants->where(function (Builder $inner) use ($teacherIds, $userIds) {
                            $inner->where(function (Builder $teacherQuery) use ($teacherIds) {
                                $teacherQuery->where('participant_type', Teacher::class)
                                    ->whereIn('participant_id', $teacherIds);
                            })->orWhere(function (Builder $userQuery) use ($userIds) {
                                $userQuery->where('participant_type', User::class)
                                    ->whereIn('participant_id', $userIds);
                            });
                        });
                    });
            });
        }

        $from = $request->input('from');
        if (is_string($from) && $from !== '') {
            $query->whereDate('last_message_at', '>=', $from);
        }

        $to = $request->input('to');
        if (is_string($to) && $to !== '') {
            $query->whereDate('last_message_at', '<=', $to);
        }

        if ($request->boolean('unread')) {
            $query->whereHas('messages', function (Builder $builder) use ($actor) {
                $builder->where('status', '!=', Communication::STATUS_DRAFT)
                    ->whereHas('recipients', function (Builder $recipients) use ($actor) {
                        $this->whereRecipientActor($recipients, $actor)->whereNull('read_at');
                    });
            });
        }
    }

    /**
     * @return array{0: Collection<int, Teacher>, 1: Collection<int, User>}
     */
    private function resolveReplyRecipients(
        User|Teacher $actor,
        CommunicationConversation $conversation,
        Communication $parent,
        string $mode,
    ): array {
        $conversation->loadMissing(['participants.participant', 'startedBy']);
        $parent->loadMissing(['sender', 'recipients.teacher', 'recipients.user']);

        $teachers = collect();
        $users = collect();

        $add = function (mixed $model) use ($actor, &$teachers, &$users): void {
            if ($model instanceof Teacher && (int) $model->id !== ($actor instanceof Teacher ? (int) $actor->id : 0)) {
                $teachers->put($model->id, $model);
            }

            if ($model instanceof User && (int) $model->id !== ($actor instanceof User ? (int) $actor->id : 0)) {
                $users->put($model->id, $model);
            }
        };

        if ($mode === 'reply') {
            if ($parent->sender && ! $this->isSender($actor, $parent)) {
                $add($parent->sender);
            } elseif ($conversation->startedBy && ! $this->sameActor($actor, $conversation->started_by_type, (int) $conversation->started_by_id)) {
                $add($conversation->startedBy);
            } else {
                foreach ($parent->recipients as $recipient) {
                    $add($recipient->teacher ?? $recipient->user);
                }
            }
        } else {
            foreach ($conversation->participants as $row) {
                $add($row->participant);
            }

            $add($parent->sender);
            foreach ($parent->recipients as $recipient) {
                $add($recipient->teacher ?? $recipient->user);
            }
        }

        return [$teachers->values(), $users->values()];
    }

    private function markConversationRead(User|Teacher $actor, CommunicationConversation $conversation): void
    {
        foreach ($conversation->messages as $message) {
            if ($message->isDraft()) {
                continue;
            }

            $this->markRead($actor, $message);
        }

        $conversation->participants()
            ->where('participant_type', $actor::class)
            ->where('participant_id', $actor->getKey())
            ->update(['last_read_at' => now()]);
    }

    private function loadConversation(CommunicationConversation $conversation): void
    {
        $conversation->load([
            'startedBy',
            'participants.participant',
            'messages' => fn ($query) => $query->orderBy('id')->with([
                'sender',
                'parent.sender',
                'targets',
                'recipients.teacher.faculty',
                'recipients.teacher.department',
                'recipients.user',
            ]),
        ]);
    }

    private function ensureConversation(Communication $communication, User|Teacher $actor): CommunicationConversation
    {
        if ($communication->conversation instanceof CommunicationConversation) {
            $this->addParticipant($communication->conversation, $actor, markRead: true);

            return $communication->conversation;
        }

        if ($communication->conversation_id) {
            $conversation = CommunicationConversation::query()->find($communication->conversation_id);
            if ($conversation instanceof CommunicationConversation) {
                $this->addParticipant($conversation, $actor, markRead: true);

                return $conversation;
            }
        }

        $conversation = CommunicationConversation::create([
            'subject' => $communication->subject,
            'started_by_type' => $communication->sender_type,
            'started_by_id' => $communication->sender_id,
            'message_count' => 0,
            'last_message_preview' => $this->excerpt((string) $communication->body),
            'last_message_at' => now(),
        ]);

        $communication->update(['conversation_id' => $conversation->id]);
        $this->addParticipant($conversation, $actor, markRead: true);

        return $conversation;
    }

    private function refreshConversation(CommunicationConversation $conversation): void
    {
        $last = $conversation->messages()
            ->where('status', '!=', Communication::STATUS_DRAFT)
            ->latest('id')
            ->first()
            ?? $conversation->messages()->latest('id')->first();

        $conversation->update([
            'message_count' => $conversation->messages()
                ->where('status', '!=', Communication::STATUS_DRAFT)
                ->count(),
            'last_message_preview' => $last ? $this->excerpt((string) $last->body) : $conversation->last_message_preview,
            'last_message_at' => $last?->sent_at ?? $last?->created_at ?? $conversation->last_message_at,
        ]);
    }

    private function addParticipant(CommunicationConversation $conversation, User|Teacher $actor, bool $markRead = false): void
    {
        $participant = CommunicationConversationParticipant::query()->firstOrCreate(
            [
                'conversation_id' => $conversation->id,
                'participant_type' => $actor::class,
                'participant_id' => $actor->getKey(),
            ],
            [
                'last_read_at' => $markRead ? now() : null,
            ],
        );

        if ($markRead) {
            $participant->update(['last_read_at' => now()]);
        }
    }

    private function addTeacherRecipient(Communication $communication, Teacher $teacher): void
    {
        CommunicationRecipient::query()->firstOrCreate(
            [
                'communication_id' => $communication->id,
                'teacher_id' => $teacher->id,
            ],
            [
                'user_id' => null,
                'status' => CommunicationRecipient::STATUS_PENDING,
            ],
        );
    }

    private function addUserRecipient(Communication $communication, User $user): void
    {
        CommunicationRecipient::query()->firstOrCreate(
            [
                'communication_id' => $communication->id,
                'user_id' => $user->id,
            ],
            [
                'teacher_id' => null,
                'status' => CommunicationRecipient::STATUS_PENDING,
            ],
        );
    }

    private function isParticipant(User|Teacher $actor, ?CommunicationConversation $conversation): bool
    {
        if (! $conversation instanceof CommunicationConversation) {
            return false;
        }

        return $conversation->participants()
            ->where('participant_type', $actor::class)
            ->where('participant_id', $actor->getKey())
            ->exists();
    }

    private function whereParticipantActor(Builder $query, User|Teacher $actor): Builder
    {
        return $query->where('participant_type', $actor::class)
            ->where('participant_id', $actor->getKey());
    }

    private function whereRecipientActor(mixed $query, User|Teacher $actor): mixed
    {
        if ($actor instanceof Teacher) {
            return $query->where('teacher_id', $actor->id);
        }

        return $query->where('user_id', $actor->id);
    }

    private function recipientQuery(mixed $query, User|Teacher $actor): mixed
    {
        return $this->whereRecipientActor($query, $actor);
    }

    private function sameActor(User|Teacher $actor, ?string $type, int $id): bool
    {
        return $type === $actor::class && $id === (int) $actor->getKey();
    }

    private function recipientName(CommunicationRecipient $recipient): string
    {
        if ($recipient->teacher) {
            return $this->teacherLabel($recipient->teacher);
        }

        if ($recipient->user) {
            return $recipient->user->name ?: $recipient->user->email;
        }

        return 'Staff';
    }

    /**
     * @param  list<array{type: string, id: int, name: string, initials: string}|null>  $participants
     * @param  array{type: string, id: int, name: string, initials: string}|null  $from
     */
    private function participantLabel(array $participants, User|Teacher $actor, ?array $from): string
    {
        $names = collect($participants)
            ->filter()
            ->reject(fn (array $row) => $row['type'] === ($actor instanceof Teacher ? 'teacher' : 'admin')
                && (int) $row['id'] === (int) $actor->getKey())
            ->pluck('name')
            ->filter()
            ->values();

        if ($names->isEmpty()) {
            return $from['name'] ?? 'Conversation';
        }

        if ($names->count() <= 2) {
            return $names->implode(', ');
        }

        return $names->take(2)->implode(', ').' +'.($names->count() - 2);
    }

    /**
     * @return array{type: string, id: int, name: string, initials: string}|null
     */
    private function serializeActor(mixed $actor): ?array
    {
        if ($actor instanceof Teacher) {
            $name = $this->teacherLabel($actor);

            return [
                'type' => 'teacher',
                'id' => $actor->id,
                'name' => $name,
                'initials' => $this->initials($name),
            ];
        }

        if ($actor instanceof User) {
            $name = $actor->name ?: $actor->email;

            return [
                'type' => 'admin',
                'id' => $actor->id,
                'name' => $name,
                'initials' => $this->initials((string) $name),
            ];
        }

        return null;
    }

    private function initials(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name)) ?: [];
        $letters = collect($parts)
            ->filter()
            ->take(2)
            ->map(fn (string $part) => mb_strtoupper(mb_substr($part, 0, 1)));

        return $letters->implode('') ?: '?';
    }
}
