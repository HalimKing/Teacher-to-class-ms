<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\HelpDeskTicket;
use App\Models\User;
use App\Services\HelpDeskService;
use App\Support\HelpDeskAttachment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class HelpDeskController extends Controller
{
    public function __construct(
        private HelpDeskService $service,
    ) {}

    public function index(Request $request): Response
    {
        $query = HelpDeskTicket::query()
            ->with(['creator', 'assignee'])
            ->latest('id');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($category = $request->get('category')) {
            $query->where('category', $category);
        }

        if ($priority = $request->get('priority')) {
            $query->where('priority', $priority);
        }

        if ($assignedTo = $request->get('assigned_to')) {
            if ($assignedTo === 'unassigned') {
                $query->whereNull('assigned_to');
            } else {
                $query->where('assigned_to', $assignedTo);
            }
        }

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('ticket_number', 'like', "%{$search}%")
                    ->orWhere('subject', 'like', "%{$search}%")
                    ->orWhereHas('creator', function ($creatorQuery) use ($search) {
                        $creatorQuery->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhere('employee_id', 'like', "%{$search}%");
                    });
            });
        }

        $tickets = $query->paginate(20)->withQueryString();
        $tickets->getCollection()->transform(function (HelpDeskTicket $ticket) {
            return [
                'id' => $ticket->id,
                'ticket_number' => $ticket->ticket_number,
                'subject' => $ticket->subject,
                'category' => $ticket->category,
                'category_label' => $ticket->categoryLabel(),
                'priority' => $ticket->priority,
                'priority_label' => $ticket->priorityLabel(),
                'status' => $ticket->status,
                'status_label' => $ticket->statusLabel(),
                'creator' => $ticket->creator ? [
                    'id' => $ticket->creator->id,
                    'name' => trim("{$ticket->creator->first_name} {$ticket->creator->last_name}"),
                    'employee_id' => $ticket->creator->employee_id,
                ] : null,
                'assignee' => $ticket->assignee?->only(['id', 'name']),
                'created_at' => $ticket->created_at?->toDateTimeString(),
            ];
        });

        return Inertia::render('admin/help-desk/index', [
            'tickets' => $tickets,
            'filters' => $request->only(['status', 'category', 'priority', 'assigned_to', 'search']),
            'categories' => HelpDeskTicket::CATEGORIES,
            'priorities' => HelpDeskTicket::PRIORITIES,
            'statuses' => HelpDeskTicket::STATUSES,
            'assignees' => $this->supportUsers(),
            'stats' => [
                'open' => HelpDeskTicket::where('status', HelpDeskTicket::STATUS_OPEN)->count(),
                'in_progress' => HelpDeskTicket::where('status', HelpDeskTicket::STATUS_IN_PROGRESS)->count(),
                'resolved' => HelpDeskTicket::where('status', HelpDeskTicket::STATUS_RESOLVED)->count(),
                'closed' => HelpDeskTicket::where('status', HelpDeskTicket::STATUS_CLOSED)->count(),
            ],
        ]);
    }

    public function show(HelpDeskTicket $helpDesk): Response
    {
        $helpDesk->load(['creator', 'assignee', 'comments', 'activities']);

        return Inertia::render('admin/help-desk/show', [
            'ticket' => [
                'id' => $helpDesk->id,
                'ticket_number' => $helpDesk->ticket_number,
                'subject' => $helpDesk->subject,
                'description' => $helpDesk->description,
                'category' => $helpDesk->category,
                'category_label' => $helpDesk->categoryLabel(),
                'priority' => $helpDesk->priority,
                'priority_label' => $helpDesk->priorityLabel(),
                'status' => $helpDesk->status,
                'status_label' => $helpDesk->statusLabel(),
                'creator' => $helpDesk->creator ? [
                    'id' => $helpDesk->creator->id,
                    'name' => trim("{$helpDesk->creator->title} {$helpDesk->creator->first_name} {$helpDesk->creator->last_name}"),
                    'employee_id' => $helpDesk->creator->employee_id,
                    'email' => $helpDesk->creator->email,
                ] : null,
                'assignee' => $helpDesk->assignee?->only(['id', 'name']),
                'attachment_name' => $helpDesk->attachment_name,
                'attachment_url' => $helpDesk->attachment_path
                    ? route('admin.help-desk.attachment', $helpDesk)
                    : null,
                'attachment_preview_url' => HelpDeskAttachment::isImage($helpDesk->attachment_name)
                    ? HelpDeskAttachment::publicUrl($helpDesk->attachment_path)
                    : null,
                'created_at' => $helpDesk->created_at?->toDateTimeString(),
                'resolved_at' => $helpDesk->resolved_at?->toDateTimeString(),
                'closed_at' => $helpDesk->closed_at?->toDateTimeString(),
                'comments' => $helpDesk->comments->sortBy('id')->values()->map(fn ($comment) => [
                    'id' => $comment->id,
                    'body' => $comment->body,
                    'author_name' => $comment->authorName(),
                    'author_role' => $comment->authorRoleLabel(),
                    'author_type' => $comment->author_type,
                    'attachment_name' => $comment->attachment_name,
                    'attachment_url' => $comment->attachment_path
                        ? route('admin.help-desk.comment-attachment', [$helpDesk, $comment->id])
                        : null,
                    'attachment_preview_url' => HelpDeskAttachment::isImage($comment->attachment_name)
                        ? HelpDeskAttachment::publicUrl($comment->attachment_path)
                        : null,
                    'created_at' => $comment->created_at?->toDateTimeString(),
                ]),
                'activities' => $helpDesk->activities->sortByDesc('id')->values()->map(fn ($activity) => [
                    'id' => $activity->id,
                    'action' => $activity->action,
                    'from_value' => $activity->from_value,
                    'to_value' => $activity->to_value,
                    'actor_name' => $activity->actorName(),
                    'meta' => $activity->meta,
                    'created_at' => $activity->created_at?->toDateTimeString(),
                ]),
            ],
            'categories' => HelpDeskTicket::CATEGORIES,
            'priorities' => HelpDeskTicket::PRIORITIES,
            'statuses' => HelpDeskTicket::STATUSES,
            'assignees' => $this->supportUsers(),
        ]);
    }

    public function assign(Request $request, HelpDeskTicket $helpDesk): RedirectResponse
    {
        $data = $request->validate([
            'assigned_to' => ['nullable', 'exists:users,id'],
        ]);

        $assignee = ! empty($data['assigned_to'])
            ? User::findOrFail($data['assigned_to'])
            : null;

        $this->service->assign($helpDesk, $assignee, $request->user());

        return back()->with('success', $assignee ? 'Ticket assigned.' : 'Assignment cleared.');
    }

    public function updateStatus(Request $request, HelpDeskTicket $helpDesk): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(array_keys(HelpDeskTicket::STATUSES))],
        ]);

        try {
            $this->service->updateStatus($helpDesk, $data['status'], $request->user());
        } catch (\InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Ticket status updated.');
    }

    public function comment(Request $request, HelpDeskTicket $helpDesk): RedirectResponse
    {
        if ($helpDesk->status === HelpDeskTicket::STATUS_CLOSED) {
            return back()->with('error', 'Closed tickets cannot receive new replies.');
        }

        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
            'attachment' => ['nullable', 'file', 'max:5120', 'mimes:pdf,jpg,jpeg,png,doc,docx'],
        ]);

        $this->service->addComment($helpDesk, $request->user(), $data['body'], $request->file('attachment'));

        return back()->with('success', 'Reply added.');
    }

    public function attachment(HelpDeskTicket $helpDesk): BinaryFileResponse
    {
        if (!$helpDesk->attachment_path) {
            abort(404);
        }

        return HelpDeskAttachment::serve(
            $helpDesk->attachment_path,
            $helpDesk->attachment_name,
            asDownload: ! HelpDeskAttachment::isImage($helpDesk->attachment_name),
        );
    }

    public function commentAttachment(HelpDeskTicket $helpDesk, int $comment): BinaryFileResponse
    {
        $commentModel = $helpDesk->comments()->whereKey($comment)->firstOrFail();
        if (!$commentModel->attachment_path) {
            abort(404);
        }

        return HelpDeskAttachment::serve(
            $commentModel->attachment_path,
            $commentModel->attachment_name,
            asDownload: ! HelpDeskAttachment::isImage($commentModel->attachment_name),
        );
    }

    /**
     * @return array<int, array{id: int, name: string}>
     */
    private function supportUsers(): array
    {
        $users = User::query()
            ->permission('admin.help-desk.manage')
            ->orderBy('name')
            ->get(['id', 'name']);

        if ($users->isEmpty()) {
            $users = User::role('Super Admin')->orderBy('name')->get(['id', 'name']);
        }

        return $users->map(fn (User $user) => [
            'id' => $user->id,
            'name' => $user->name,
        ])->values()->all();
    }
}
