<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReplyCommunicationRequest;
use App\Http\Requests\StoreCommunicationRequest;
use App\Models\Communication;
use App\Models\CommunicationConversation;
use App\Services\CommunicationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CommunicationController extends Controller
{
    public function __construct(private readonly CommunicationService $communications) {}

    public function index(Request $request): Response
    {
        $actor = $request->user('web');
        $stats = $this->communications->dashboardStats($actor);

        return Inertia::render('admin/communication/index', [
            'stats' => $stats,
            'recent' => $this->communications->recentSent($actor)->map(
                fn (Communication $communication) => $this->communications->serialize($communication, $actor)
            ),
            'capabilities' => $this->communications->capabilities($actor),
        ]);
    }

    public function inbox(Request $request): Response
    {
        return $this->mailbox($request, 'inbox');
    }

    public function sent(Request $request): Response
    {
        return $this->mailbox($request, 'sent');
    }

    public function drafts(Request $request): Response
    {
        return $this->mailbox($request, 'drafts');
    }

    public function all(Request $request): Response
    {
        return $this->mailbox($request, 'all');
    }

    public function compose(Request $request): Response
    {
        $actor = $request->user('web');

        return Inertia::render('admin/communication/compose', [
            'capabilities' => $this->communications->capabilities($actor),
            'faculties' => $this->communications->searchableFaculties($actor),
            'departments' => $this->communications->searchableDepartments($actor),
        ]);
    }

    public function preview(StoreCommunicationRequest $request): JsonResponse
    {
        return response()->json(
            $this->communications->preview($request->user('web'), $request->payload())
        );
    }

    public function store(StoreCommunicationRequest $request): RedirectResponse
    {
        $asDraft = $request->boolean('save_as_draft');
        $communication = $this->communications->save($request->user('web'), $request->payload(), $asDraft);

        if ($asDraft) {
            return redirect()
                ->route('admin.communication.drafts')
                ->with('success', 'Draft saved.');
        }

        return $this->redirectAfterSend($communication);
    }

    public function show(Request $request, Communication $communication): RedirectResponse
    {
        $communication = $this->communications->findForActor($request->user('web'), $communication);

        if (! $communication->conversation_id) {
            abort(404);
        }

        return redirect()->route('admin.communication.thread', $communication->conversation_id);
    }

    public function thread(Request $request, CommunicationConversation $conversation): Response
    {
        $actor = $request->user('web');
        $conversation = $this->communications->findConversationForActor($actor, $conversation);

        return Inertia::render('admin/communication/thread', [
            'conversation' => $this->communications->serializeThread($conversation, $actor),
            'capabilities' => $this->communications->capabilities($actor),
            'folder' => $request->string('from')->toString() ?: 'inbox',
            'counts' => $this->communications->folderCounts($actor),
        ]);
    }

    public function reply(ReplyCommunicationRequest $request, CommunicationConversation $conversation): RedirectResponse
    {
        $communication = $this->communications->reply(
            $request->user('web'),
            $conversation,
            $request->payload(),
        );

        return redirect()
            ->route('admin.communication.thread', $communication->conversation_id)
            ->with('success', 'Reply sent.');
    }

    public function send(Request $request, Communication $communication): RedirectResponse
    {
        $communication = $this->communications->sendDraft($request->user('web'), $communication);

        return $this->redirectAfterSend($communication);
    }

    public function faculties(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->communications->searchableFaculties(
                $request->user('web'),
                $request->string('search')->toString() ?: null,
            ),
        ]);
    }

    public function departments(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->communications->searchableDepartments(
                $request->user('web'),
                $request->string('search')->toString() ?: null,
                $request->integer('faculty_id') ?: null,
            ),
        ]);
    }

    public function staff(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->communications->searchableStaff(
                $request->user('web'),
                $request->string('search')->toString() ?: null,
                $request->integer('faculty_id') ?: null,
                $request->integer('department_id') ?: null,
            ),
        ]);
    }

    private function mailbox(Request $request, string $folder): Response
    {
        $actor = $request->user('web');

        return Inertia::render('admin/communication/mailbox', [
            ...$this->communications->folderPayload($actor, $folder, $request),
        ]);
    }

    private function redirectAfterSend(Communication $communication): RedirectResponse
    {
        $communication->refresh();

        if ($communication->status === Communication::STATUS_FAILED) {
            return redirect()
                ->route('admin.communication.thread', $communication->conversation_id)
                ->with('error', 'The message could not be delivered.');
        }

        if ($communication->status === Communication::STATUS_PARTIAL) {
            return redirect()
                ->route('admin.communication.thread', $communication->conversation_id)
                ->with('error', 'The message was only partially delivered.');
        }

        return redirect()
            ->route('admin.communication.thread', $communication->conversation_id)
            ->with('success', "Message sent to {$communication->recipient_count} staff member(s).");
    }
}
