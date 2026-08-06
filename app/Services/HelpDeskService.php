<?php

namespace App\Services;

use App\Models\HelpDeskActivity;
use App\Models\HelpDeskComment;
use App\Models\HelpDeskTicket;
use App\Models\Teacher;
use App\Models\User;
use App\Notifications\AdminHelpDeskTicketSubmitted;
use App\Notifications\AdminHelpDeskTicketUpdated;
use App\Support\LecturerNotificationPayload;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

class HelpDeskService
{
    public function __construct(
        private LecturerNotificationService $notifications,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function createTicket(Teacher $creator, array $data, ?UploadedFile $attachment = null): HelpDeskTicket
    {
        return DB::transaction(function () use ($creator, $data, $attachment) {
            [$attachmentPath, $attachmentName] = $this->storeAttachment($attachment);

            $ticket = HelpDeskTicket::create([
                'ticket_number' => $this->generateTicketNumber(),
                'subject' => $data['subject'],
                'description' => $data['description'],
                'category' => $data['category'],
                'priority' => $data['priority'] ?? HelpDeskTicket::PRIORITY_MEDIUM,
                'status' => HelpDeskTicket::STATUS_OPEN,
                'created_by' => $creator->id,
                'attachment_path' => $attachmentPath,
                'attachment_name' => $attachmentName,
            ]);

            $this->logActivity(
                $ticket,
                HelpDeskActivity::ACTION_CREATED,
                HelpDeskComment::AUTHOR_TEACHER,
                $creator->id,
                null,
                HelpDeskTicket::STATUS_OPEN,
                ['subject' => $ticket->subject],
            );

            $this->notifyAdminsSubmitted($ticket->load('creator'));

            return $ticket;
        });
    }

    public function addComment(
        HelpDeskTicket $ticket,
        Teacher|User $actor,
        string $body,
        ?UploadedFile $attachment = null,
    ): HelpDeskComment {
        return DB::transaction(function () use ($ticket, $actor, $body, $attachment) {
            [$attachmentPath, $attachmentName] = $this->storeAttachment($attachment);

            $authorType = $actor instanceof Teacher
                ? HelpDeskComment::AUTHOR_TEACHER
                : HelpDeskComment::AUTHOR_USER;

            $comment = HelpDeskComment::create([
                'ticket_id' => $ticket->id,
                'body' => $body,
                'author_type' => $authorType,
                'author_id' => $actor->id,
                'attachment_path' => $attachmentPath,
                'attachment_name' => $attachmentName,
            ]);

            $this->logActivity(
                $ticket,
                HelpDeskActivity::ACTION_COMMENTED,
                $authorType,
                $actor->id,
                null,
                null,
                ['comment_id' => $comment->id],
            );

            if ($actor instanceof User) {
                $this->notifyCreatorOfAdminUpdate(
                    $ticket,
                    'help_desk_ticket_replied',
                    'Help Desk Reply',
                    "Support replied to ticket {$ticket->ticket_number}.",
                );

                if ($ticket->status === HelpDeskTicket::STATUS_OPEN) {
                    $this->updateStatus($ticket, HelpDeskTicket::STATUS_IN_PROGRESS, $actor, notify: false);
                }
            } else {
                $this->notifyAssigneesOfStaffReply($ticket);
            }

            return $comment;
        });
    }

    public function assign(HelpDeskTicket $ticket, ?User $assignee, User $actor): HelpDeskTicket
    {
        return DB::transaction(function () use ($ticket, $assignee, $actor) {
            $previous = $ticket->assigned_to;
            $ticket->update([
                'assigned_to' => $assignee?->id,
            ]);

            if ($ticket->status === HelpDeskTicket::STATUS_OPEN && $assignee) {
                $ticket->update(['status' => HelpDeskTicket::STATUS_IN_PROGRESS]);
            }

            $this->logActivity(
                $ticket,
                HelpDeskActivity::ACTION_ASSIGNED,
                HelpDeskComment::AUTHOR_USER,
                $actor->id,
                $previous ? (string) $previous : null,
                $assignee ? (string) $assignee->id : null,
                [
                    'assignee_name' => $assignee?->name,
                ],
            );

            if ($assignee && $previous !== $assignee->id) {
                $this->notifyCreatorOfAdminUpdate(
                    $ticket,
                    'help_desk_ticket_assigned',
                    'Ticket Assigned',
                    "Ticket {$ticket->ticket_number} was assigned to support.",
                );
            }

            return $ticket->fresh(['creator', 'assignee']);
        });
    }

    public function updateStatus(
        HelpDeskTicket $ticket,
        string $status,
        User $actor,
        bool $notify = true,
    ): HelpDeskTicket {
        if (! array_key_exists($status, HelpDeskTicket::STATUSES)) {
            throw new \InvalidArgumentException('Invalid ticket status.');
        }

        return DB::transaction(function () use ($ticket, $status, $actor, $notify) {
            $from = $ticket->status;
            if ($from === $status) {
                return $ticket;
            }

            $updates = ['status' => $status];

            if ($status === HelpDeskTicket::STATUS_RESOLVED) {
                $updates['resolved_at'] = now();
            }

            if ($status === HelpDeskTicket::STATUS_CLOSED) {
                $updates['closed_at'] = now();
                if (!$ticket->resolved_at) {
                    $updates['resolved_at'] = now();
                }
            }

            if ($status === HelpDeskTicket::STATUS_OPEN || $status === HelpDeskTicket::STATUS_IN_PROGRESS) {
                $updates['resolved_at'] = null;
                $updates['closed_at'] = null;
            }

            $ticket->update($updates);

            $this->logActivity(
                $ticket,
                HelpDeskActivity::ACTION_STATUS_CHANGED,
                HelpDeskComment::AUTHOR_USER,
                $actor->id,
                $from,
                $status,
            );

            if ($notify) {
                $this->notifyCreatorOfAdminUpdate(
                    $ticket,
                    'help_desk_ticket_status_changed',
                    'Ticket Status Updated',
                    "Ticket {$ticket->ticket_number} is now " . (HelpDeskTicket::STATUSES[$status] ?? $status) . '.',
                );
            }

            return $ticket->fresh(['creator', 'assignee']);
        });
    }

    public function closeByCreator(HelpDeskTicket $ticket, Teacher $creator): HelpDeskTicket
    {
        if ((int) $ticket->created_by !== (int) $creator->id) {
            throw new \InvalidArgumentException('You can only close your own tickets.');
        }

        if ($ticket->status === HelpDeskTicket::STATUS_CLOSED) {
            return $ticket;
        }

        if ($ticket->status !== HelpDeskTicket::STATUS_RESOLVED) {
            throw new \InvalidArgumentException('Only resolved tickets can be closed.');
        }

        return DB::transaction(function () use ($ticket, $creator) {
            $from = $ticket->status;
            $ticket->update([
                'status' => HelpDeskTicket::STATUS_CLOSED,
                'closed_at' => now(),
            ]);

            $this->logActivity(
                $ticket,
                HelpDeskActivity::ACTION_CLOSED,
                HelpDeskComment::AUTHOR_TEACHER,
                $creator->id,
                $from,
                HelpDeskTicket::STATUS_CLOSED,
            );

            return $ticket->fresh(['creator', 'assignee']);
        });
    }

    private function generateTicketNumber(): string
    {
        $prefix = 'HD-' . now()->format('Ymd') . '-';

        $latest = HelpDeskTicket::query()
            ->where('ticket_number', 'like', $prefix . '%')
            ->orderByDesc('ticket_number')
            ->value('ticket_number');

        $sequence = 1;
        if ($latest && preg_match('/-(\d+)$/', $latest, $matches)) {
            $sequence = ((int) $matches[1]) + 1;
        }

        return $prefix . str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
    }

    /**
     * @return array{0: ?string, 1: ?string}
     */
    private function storeAttachment(?UploadedFile $attachment): array
    {
        if (!$attachment) {
            return [null, null];
        }

        return [
            $attachment->store('help-desk', 'public'),
            $attachment->getClientOriginalName(),
        ];
    }

    /**
     * @param  array<string, mixed>|null  $meta
     */
    private function logActivity(
        HelpDeskTicket $ticket,
        string $action,
        ?string $actorType,
        ?int $actorId,
        ?string $fromValue = null,
        ?string $toValue = null,
        ?array $meta = null,
    ): void {
        HelpDeskActivity::create([
            'ticket_id' => $ticket->id,
            'actor_type' => $actorType,
            'actor_id' => $actorId,
            'action' => $action,
            'from_value' => $fromValue,
            'to_value' => $toValue,
            'meta' => $meta,
            'created_at' => now(),
        ]);
    }

    private function notifyAdminsSubmitted(HelpDeskTicket $ticket): void
    {
        $admins = User::query()
            ->permission('admin.help-desk.manage')
            ->get();

        if ($admins->isEmpty()) {
            $admins = User::role('Super Admin')->get();
        }

        if ($admins->isEmpty()) {
            return;
        }

        Notification::send($admins, new AdminHelpDeskTicketSubmitted($ticket));
    }

    private function notifyCreatorOfAdminUpdate(
        HelpDeskTicket $ticket,
        string $type,
        string $title,
        string $message,
    ): void {
        $creator = $ticket->creator ?? Teacher::find($ticket->created_by);
        if (!$creator) {
            return;
        }

        $this->notifications->notify($creator, LecturerNotificationPayload::make(
            type: $type,
            category: LecturerNotificationPayload::CATEGORY_SYSTEM,
            priority: LecturerNotificationPayload::PRIORITY_MEDIUM,
            title: $title,
            message: $message,
            url: '/teacher/help-desk/' . $ticket->id,
            meta: [
                'ticket_id' => $ticket->id,
                'ticket_number' => $ticket->ticket_number,
                'status' => $ticket->status,
            ],
        ));
    }

    private function notifyAssigneesOfStaffReply(HelpDeskTicket $ticket): void
    {
        $recipients = collect();

        if ($ticket->assigned_to) {
            $assignee = User::find($ticket->assigned_to);
            if ($assignee) {
                $recipients->push($assignee);
            }
        }

        if ($recipients->isEmpty()) {
            $recipients = User::query()->permission('admin.help-desk.manage')->get();
        }

        if ($recipients->isEmpty()) {
            $recipients = User::role('Super Admin')->get();
        }

        if ($recipients->isEmpty()) {
            return;
        }

        Notification::send($recipients, new AdminHelpDeskTicketUpdated(
            $ticket->loadMissing('creator'),
            'Staff replied to help desk ticket',
            "Staff replied to ticket {$ticket->ticket_number}.",
        ));
    }
}
