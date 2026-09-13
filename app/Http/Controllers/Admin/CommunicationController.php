<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCommunicationRequest;
use App\Models\Communication;
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
                ->route('admin.communication.sent')
                ->with('success', 'Draft saved.');
        }

        $communication->refresh();

        if ($communication->status === Communication::STATUS_FAILED) {
            return redirect()
                ->route('admin.communication.show', $communication)
                ->with('error', 'The message could not be delivered.');
        }

        if ($communication->status === Communication::STATUS_PARTIAL) {
            return redirect()
                ->route('admin.communication.show', $communication)
                ->with('error', 'The message was only partially delivered.');
        }

        return redirect()
            ->route('admin.communication.show', $communication)
            ->with('success', "Message sent to {$communication->recipient_count} staff member(s).");
    }

    public function sent(Request $request): Response
    {
        $actor = $request->user('web');
        $messages = $this->communications->paginateSent($actor, $request);

        $messages->getCollection()->transform(
            fn (Communication $communication) => $this->communications->serialize($communication, $actor)
        );

        return Inertia::render('admin/communication/sent', [
            'messages' => $messages,
            'filters' => $request->only(['search', 'status', 'from', 'to', 'recipient_type']),
            'statuses' => Communication::STATUS_LABELS,
            'capabilities' => $this->communications->capabilities($actor),
        ]);
    }

    public function show(Request $request, Communication $communication): Response
    {
        $actor = $request->user('web');
        $communication = $this->communications->findForActor($actor, $communication);

        return Inertia::render('admin/communication/show', [
            'message' => $this->communications->serialize($communication, $actor),
            'capabilities' => $this->communications->capabilities($actor),
        ]);
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
}
