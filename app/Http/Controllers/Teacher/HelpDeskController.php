<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\HelpDeskTicket;
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
        $staff = auth('teacher')->user();

        $query = HelpDeskTicket::query()
            ->with(['assignee'])
            ->where('created_by', $staff->id)
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

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('ticket_number', 'like', "%{$search}%")
                    ->orWhere('subject', 'like', "%{$search}%");
            });
        }

        $tickets = $query->paginate(15)->withQueryString();
        $tickets->getCollection()->transform(fn (HelpDeskTicket $ticket) => $this->transformTicketSummary($ticket));

        return Inertia::render('teacher/help-desk/index', [
            'tickets' => $tickets,
            'filters' => $request->only(['status', 'category', 'priority', 'search']),
            'categories' => HelpDeskTicket::CATEGORIES,
            'priorities' => HelpDeskTicket::PRIORITIES,
            'statuses' => HelpDeskTicket::STATUSES,
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('teacher/help-desk/create', [
            'categories' => HelpDeskTicket::CATEGORIES,
            'priorities' => HelpDeskTicket::PRIORITIES,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $staff = auth('teacher')->user();

        $data = $request->validate([
            'subject' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:10000'],
            'category' => ['required', Rule::in(array_keys(HelpDeskTicket::CATEGORIES))],
            'priority' => ['required', Rule::in(array_keys(HelpDeskTicket::PRIORITIES))],
            'attachment' => ['nullable', 'file', 'max:5120', 'mimes:pdf,jpg,jpeg,png,doc,docx'],
        ]);

        $ticket = $this->service->createTicket($staff, $data, $request->file('attachment'));

        return redirect()
            ->route('teacher.help-desk.show', $ticket)
            ->with('success', 'Ticket submitted successfully.');
    }

    public function show(HelpDeskTicket $helpDesk): Response
    {
        $staff = auth('teacher')->user();
        $this->assertOwns($helpDesk, $staff->id);

        return Inertia::render('teacher/help-desk/show', [
            'ticket' => $this->transformTicketDetail($helpDesk, teacherAttachmentRoute: true),
            'categories' => HelpDeskTicket::CATEGORIES,
            'priorities' => HelpDeskTicket::PRIORITIES,
            'statuses' => HelpDeskTicket::STATUSES,
        ]);
    }

    public function comment(Request $request, HelpDeskTicket $helpDesk): RedirectResponse
    {
        $staff = auth('teacher')->user();
        $this->assertOwns($helpDesk, $staff->id);

        if (in_array($helpDesk->status, [HelpDeskTicket::STATUS_CLOSED], true)) {
            return back()->with('error', 'Closed tickets cannot receive new replies.');
        }

        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
            'attachment' => ['nullable', 'file', 'max:5120', 'mimes:pdf,jpg,jpeg,png,doc,docx'],
        ]);

        $this->service->addComment($helpDesk, $staff, $data['body'], $request->file('attachment'));

        return back()->with('success', 'Reply added.');
    }

    public function close(HelpDeskTicket $helpDesk): RedirectResponse
    {
        $staff = auth('teacher')->user();

        try {
            $this->service->closeByCreator($helpDesk, $staff);
        } catch (\InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Ticket closed.');
    }

    public function attachment(HelpDeskTicket $helpDesk): BinaryFileResponse
    {
        $staff = auth('teacher')->user();
        $this->assertOwns($helpDesk, $staff->id);

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
        $staff = auth('teacher')->user();
        $this->assertOwns($helpDesk, $staff->id);

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

    private function assertOwns(HelpDeskTicket $ticket, int $staffId): void
    {
        if ((int) $ticket->created_by !== $staffId) {
            abort(403);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function transformTicketSummary(HelpDeskTicket $ticket): array
    {
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
            'assignee' => $ticket->assignee?->only(['id', 'name']),
            'created_at' => $ticket->created_at?->toDateTimeString(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function transformTicketDetail(HelpDeskTicket $ticket, bool $teacherAttachmentRoute = false): array
    {
        $ticket->load(['creator', 'assignee', 'comments', 'activities']);

        $attachmentRoute = $teacherAttachmentRoute
            ? 'teacher.help-desk.attachment'
            : 'admin.help-desk.attachment';
        $commentAttachmentRoute = $teacherAttachmentRoute
            ? 'teacher.help-desk.comment-attachment'
            : 'admin.help-desk.comment-attachment';

        return [
            ...$this->transformTicketSummary($ticket),
            'description' => $ticket->description,
            'creator' => $ticket->creator ? [
                'id' => $ticket->creator->id,
                'name' => trim("{$ticket->creator->title} {$ticket->creator->first_name} {$ticket->creator->last_name}"),
                'employee_id' => $ticket->creator->employee_id,
                'email' => $ticket->creator->email,
            ] : null,
            'attachment_name' => $ticket->attachment_name,
            'attachment_url' => $ticket->attachment_path
                ? route($attachmentRoute, $ticket)
                : null,
            'attachment_preview_url' => HelpDeskAttachment::isImage($ticket->attachment_name)
                ? HelpDeskAttachment::publicUrl($ticket->attachment_path)
                : null,
            'resolved_at' => $ticket->resolved_at?->toDateTimeString(),
            'closed_at' => $ticket->closed_at?->toDateTimeString(),
            'comments' => $ticket->comments->sortBy('id')->values()->map(fn ($comment) => [
                'id' => $comment->id,
                'body' => $comment->body,
                'author_name' => $comment->authorName(),
                'author_role' => $comment->authorRoleLabel(),
                'author_type' => $comment->author_type,
                'attachment_name' => $comment->attachment_name,
                'attachment_url' => $comment->attachment_path
                    ? route($commentAttachmentRoute, [$ticket, $comment->id])
                    : null,
                'attachment_preview_url' => HelpDeskAttachment::isImage($comment->attachment_name)
                    ? HelpDeskAttachment::publicUrl($comment->attachment_path)
                    : null,
                'created_at' => $comment->created_at?->toDateTimeString(),
            ]),
            'activities' => $ticket->activities->sortByDesc('id')->values()->map(fn ($activity) => [
                'id' => $activity->id,
                'action' => $activity->action,
                'from_value' => $activity->from_value,
                'to_value' => $activity->to_value,
                'actor_name' => $activity->actorName(),
                'meta' => $activity->meta,
                'created_at' => $activity->created_at?->toDateTimeString(),
            ]),
        ];
    }
}
