<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\Teacher;
use App\Models\VenueChangeRequest;
use App\Services\LeadershipScope;
use App\Services\VenueChangeRequestService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class UnitVenueChangeRequestController extends Controller
{
    public function __construct(
        private LeadershipScope $leadershipScope,
        private VenueChangeRequestService $service,
    ) {}

    public function index(Request $request): Response
    {
        /** @var Teacher $leader */
        $leader = auth('teacher')->user();

        $query = $this->scopedRequests($leader)
            ->with([
                'staff',
                'authorizedClassroom',
                'items.originalClassroom',
                'approvals.assignedTeacher',
            ])
            ->latest('id');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($request->filled('teacher_id')) {
            $staffId = (int) $request->teacher_id;
            abort_unless($this->scopedStaffIds($leader)->contains($staffId), 403);
            $query->where('staff_id', $staffId);
        }

        $requests = $query->paginate(20)->withQueryString();
        $requests->setCollection(
            $requests->getCollection()->map(fn (VenueChangeRequest $row) => $this->service->serializeForLeader($row))
        );

        return Inertia::render('teacher/unit/venue-change-requests', [
            'requests' => $requests,
            'staff' => $this->leadershipScope->applyToTeachers(Teacher::query(), $leader)
                ->orderBy('first_name')
                ->get(['id', 'first_name', 'last_name', 'title', 'employee_id', 'staff_type']),
            'filters' => $request->only(['status', 'teacher_id']),
            'leadershipScope' => $this->leadershipScope->summary($leader),
            'statusCounts' => [
                'pending' => (clone $this->scopedRequests($leader))->pending()->count(),
                'approved' => (clone $this->scopedRequests($leader))->where('status', VenueChangeRequest::STATUS_APPROVED)->count(),
                'rejected' => (clone $this->scopedRequests($leader))->where('status', VenueChangeRequest::STATUS_REJECTED)->count(),
            ],
        ]);
    }

    public function show(Request $request, VenueChangeRequest $venueChangeRequest): Response
    {
        /** @var Teacher $leader */
        $leader = auth('teacher')->user();

        abort_unless($this->service->canLeadershipReview($leader, $venueChangeRequest), 403);

        return Inertia::render('teacher/unit/venue-change-request-show', [
            'requestRecord' => $this->service->serializeForLeader($venueChangeRequest),
            'canDecide' => $this->service->canLeadershipDecide($leader, $venueChangeRequest),
            'actorRole' => $this->service->approvalRoleForLeader($leader),
            'leadershipScope' => $this->leadershipScope->summary($leader),
        ]);
    }

    public function approve(Request $request, VenueChangeRequest $venueChangeRequest): RedirectResponse
    {
        return $this->decide($request, $venueChangeRequest, approved: true);
    }

    public function reject(Request $request, VenueChangeRequest $venueChangeRequest): RedirectResponse
    {
        return $this->decide($request, $venueChangeRequest, approved: false);
    }

    private function decide(Request $request, VenueChangeRequest $venueChangeRequest, bool $approved): RedirectResponse
    {
        /** @var Teacher $leader */
        $leader = auth('teacher')->user();

        abort_unless($this->service->canLeadershipReview($leader, $venueChangeRequest), 403);

        $data = $request->validate([
            'comments' => [$approved ? 'nullable' : 'required', 'string', 'max:2000'],
        ]);

        try {
            $updated = $this->service->recordLeadershipDecision(
                $venueChangeRequest,
                $leader,
                $approved,
                $data['comments'] ?? null,
            );
        } catch (\InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        $message = $approved
            ? ($updated->status === VenueChangeRequest::STATUS_APPROVED
                ? 'Request approved. Venue change authorization(s) are now active.'
                : 'Your approval has been recorded. The request remains pending until all required approvers have approved.')
            : 'Venue change request rejected.';

        return redirect()
            ->route('teacher.unit.venue-change-requests.show', $venueChangeRequest)
            ->with('success', $message);
    }

    private function scopedRequests(Teacher $leader)
    {
        return VenueChangeRequest::query()
            ->where(function ($query) use ($leader) {
                if ($leader->isDirectorDean() && $leader->leadership_faculty_id) {
                    $query->where('faculty_id', $leader->leadership_faculty_id)
                        ->orWhereHas('staff', fn ($staff) => $staff->where('faculty_id', $leader->leadership_faculty_id));

                    return;
                }

                if ($leader->isHeadOfDepartment() && $leader->leadership_department_id) {
                    $query->where('department_id', $leader->leadership_department_id)
                        ->orWhereHas('staff', fn ($staff) => $staff->where('department_id', $leader->leadership_department_id));

                    return;
                }

                $query->whereRaw('1 = 0');
            });
    }

    /**
     * @return \Illuminate\Support\Collection<int, int>
     */
    private function scopedStaffIds(Teacher $leader)
    {
        return $this->leadershipScope->applyToTeachers(Teacher::query(), $leader)->pluck('id');
    }
}
