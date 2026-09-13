<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\VenueChangeRequest;
use App\Services\VenueChangeRequestService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class VenueChangeRequestController extends Controller
{
    public function __construct(
        private VenueChangeRequestService $service,
    ) {}

    public function index(Request $request): Response
    {
        $query = VenueChangeRequest::query()
            ->with(['staff', 'authorizedClassroom', 'reviewer', 'items', 'approvals'])
            ->latest('id');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($search = $request->get('search')) {
            $query->whereHas('staff', function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('employee_id', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $requests = $query->paginate(20)->withQueryString();

        $requests->getCollection()->transform(function (VenueChangeRequest $row) {
            $serialized = $this->service->serializeForLeader($row);
            $row->setAttribute('schedule_count', $row->items->count());
            $row->setAttribute('approval_progress', $serialized['approval_progress']);
            $row->setAttribute('approvals', $serialized['approvals']);

            return $row;
        });

        return Inertia::render('admin/venue-change-requests/index', [
            'requests' => $requests,
            'filters' => $request->only(['status', 'search']),
            'statusCounts' => [
                'pending' => VenueChangeRequest::query()->pending()->count(),
                'approved' => VenueChangeRequest::query()->where('status', VenueChangeRequest::STATUS_APPROVED)->count(),
                'rejected' => VenueChangeRequest::query()->where('status', VenueChangeRequest::STATUS_REJECTED)->count(),
            ],
        ]);
    }

    public function show(VenueChangeRequest $venueChangeRequest): Response
    {
        $venueChangeRequest->load([
            'staff.faculty',
            'staff.department',
            'faculty',
            'department',
            'authorizedClassroom',
            'reviewer',
            'items.timetable.course',
            'items.originalClassroom',
            'resultingAuthorization',
            'resultingAuthorizations.timetable.course',
            'resultingAuthorizations.authorizedClassroom',
            'approvals.assignedTeacher',
            'approvals.decidedBy',
        ]);

        $serialized = $this->service->serializeForLeader($venueChangeRequest);

        return Inertia::render('admin/venue-change-requests/show', [
            'requestRecord' => $venueChangeRequest,
            'approvals' => $serialized['approvals'],
            'approvalProgress' => $serialized['approval_progress'],
            'canDecide' => $this->service->canAdministratorDecide($venueChangeRequest),
        ]);
    }

    public function approve(Request $request, VenueChangeRequest $venueChangeRequest): RedirectResponse
    {
        $data = $request->validate([
            'admin_comments' => ['nullable', 'string', 'max:2000'],
        ]);

        try {
            $updated = $this->service->approve(
                $venueChangeRequest,
                $request->user(),
                $data['admin_comments'] ?? null,
            );
        } catch (\InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        $message = $updated->status === VenueChangeRequest::STATUS_APPROVED
            ? 'Request approved. Venue change authorization(s) are now active.'
            : 'Your approval has been recorded. The request remains pending until all required approvers have approved.';

        return redirect()
            ->route('admin.venue-change-requests.show', $venueChangeRequest)
            ->with('success', $message);
    }

    public function reject(Request $request, VenueChangeRequest $venueChangeRequest): RedirectResponse
    {
        $data = $request->validate([
            'admin_comments' => ['nullable', 'string', 'max:2000'],
        ]);

        try {
            $this->service->reject(
                $venueChangeRequest,
                $request->user(),
                $data['admin_comments'] ?? null,
            );
        } catch (\InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Venue change request rejected.');
    }
}
