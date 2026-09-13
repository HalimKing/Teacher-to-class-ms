<?php

namespace App\Http\Controllers\Teacher;

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
        $actor = $request->user('teacher');
        $stats = $this->communications->dashboardStats($actor);

        return Inertia::render('teacher/communication/index', [
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
        $actor = $request->user('teacher');

        return Inertia::render('teacher/communication/compose', [
            'capabilities' => $this->communications->capabilities($actor),
        ]);
    }

    public function preview(StoreCommunicationRequest $request): JsonResponse
    {
        return response()->json(
            $this->communications->preview($request->user('teacher'), $request->payload())
        );
    }

    public function store(StoreCommunicationRequest $request): RedirectResponse
    {
        $asDraft = $request->boolean('save_as_draft');
        $communication = $this->communications->save($request->user('teacher'), $request->payload(), $asDraft);

        if ($asDraft) {
            return redirect()
                ->route('teacher.communication.drafts')
                ->with('success', 'Draft saved.');
        }

        return $this->redirectAfterSend('teacher', $communication);
    }

    public function show(Request $request, Communication $communication): RedirectResponse
    {
        $communication = $this->communications->findForActor($request->user('teacher'), $communication);

        if (! $communication->conversation_id) {
            abort(404);
        }

        return redirect()->route('teacher.communication.thread', $communication->conversation_id);
    }

    public function thread(Request $request, CommunicationConversation $conversation): Response
    {
        $actor = $request->user('teacher');
        $conversation = $this->communications->findConversationForActor($actor, $conversation);

        return Inertia::render('teacher/communication/thread', [
            'conversation' => $this->communications->serializeThread($conversation, $actor),
            'capabilities' => $this->communications->capabilities($actor),
            'folder' => $request->string('from')->toString() ?: 'inbox',
            'counts' => $this->communications->folderCounts($actor),
        ]);
    }

    public function reply(ReplyCommunicationRequest $request, CommunicationConversation $conversation): RedirectResponse
    {
        $communication = $this->communications->reply(
            $request->user('teacher'),
            $conversation,
            $request->payload(),
        );

        return redirect()
            ->route('teacher.communication.thread', $communication->conversation_id)
            ->with('success', 'Reply sent.');
    }

    public function send(Request $request, Communication $communication): RedirectResponse
    {
        $communication = $this->communications->sendDraft($request->user('teacher'), $communication);

        return $this->redirectAfterSend('teacher', $communication);
    }

    public function staff(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->communications->searchableStaff(
                $request->user('teacher'),
                $request->string('search')->toString() ?: null,
            ),
        ]);
    }

    private function mailbox(Request $request, string $folder): Response
    {
        $actor = $request->user('teacher');

        return Inertia::render('teacher/communication/mailbox', [
            ...$this->communications->folderPayload($actor, $folder, $request),
        ]);
    }

    private function redirectAfterSend(string $guard, Communication $communication): RedirectResponse
    {
        $communication->refresh();
        $threadRoute = $guard === 'admin' ? 'admin.communication.thread' : 'teacher.communication.thread';

        if ($communication->status === Communication::STATUS_FAILED) {
            return redirect()
                ->route($threadRoute, $communication->conversation_id)
                ->with('error', 'The message could not be delivered.');
        }

        if ($communication->status === Communication::STATUS_PARTIAL) {
            return redirect()
                ->route($threadRoute, $communication->conversation_id)
                ->with('error', 'The message was only partially delivered.');
        }

        return redirect()
            ->route($threadRoute, $communication->conversation_id)
            ->with('success', "Message sent to {$communication->recipient_count} staff member(s).");
    }
}
