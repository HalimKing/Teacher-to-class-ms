<?php

namespace App\Services;

use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Models\TimeTable;
use App\Models\User;
use App\Models\VenueChangeAuthorization;
use App\Models\VenueChangeRequest;
use App\Models\VenueChangeRequestItem;
use App\Notifications\AdminVenueChangeRequestSubmitted;
use App\Support\LecturerNotificationPayload;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use InvalidArgumentException;

class VenueChangeRequestService
{
    public function __construct(
        private ActivityLogService $activityLog,
        private LecturerNotificationService $notifications,
        private VenueChangeAuthorizationService $authorizationService,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     * @param  array<int, int>  $timetableIds
     */
    public function submit(Teacher $staff, array $data, array $timetableIds): VenueChangeRequest
    {
        if (!$staff->isAdministrator()) {
            throw new InvalidArgumentException('Only administrator staff can submit venue change requests.');
        }

        if (!SystemSetting::administratorVenueChangeRequestsEnabled()) {
            throw new InvalidArgumentException('Administrator venue change requests are currently disabled by system settings.');
        }

        $timetableIds = array_values(array_unique(array_map('intval', $timetableIds)));

        if ($timetableIds === []) {
            throw new InvalidArgumentException('Select at least one schedule.');
        }

        $startDate = (string) $data['start_date'];
        $endDate = (string) $data['end_date'];

        if (Carbon::parse($endDate)->lt(Carbon::parse($startDate))) {
            throw new InvalidArgumentException('End date cannot be earlier than start date.');
        }

        $authorizedClassroomId = (int) $data['authorized_classroom_id'];
        $authorizationType = (string) $data['authorization_type'];

        $schedules = TimeTable::query()
            ->with('classRoom')
            ->whereIn('id', $timetableIds)
            ->get();

        if ($schedules->count() !== count($timetableIds)) {
            throw new InvalidArgumentException('One or more selected schedules could not be found.');
        }

        foreach ($schedules as $schedule) {
            if ((int) $schedule->teacher_id !== (int) $staff->id) {
                throw new InvalidArgumentException("Schedule #{$schedule->id} does not belong to you.");
            }

            if ($schedule->staff_type !== Teacher::STAFF_TYPE_ADMINISTRATOR) {
                throw new InvalidArgumentException("Schedule #{$schedule->id} is not an administrator schedule.");
            }

            if (!$schedule->class_room_id) {
                throw new InvalidArgumentException("Schedule #{$schedule->id} has no assigned venue.");
            }

            if ((int) $schedule->class_room_id === $authorizedClassroomId) {
                throw new InvalidArgumentException(
                    "Replacement venue must differ from the original venue for schedule #{$schedule->id}."
                );
            }
        }

        $authConflicts = $this->authorizationService->findConflicts(
            (int) $staff->id,
            $startDate,
            $endDate,
            $timetableIds,
            $authorizationType,
        );

        if ($authConflicts->isNotEmpty()) {
            throw new InvalidArgumentException(
                'An active venue change authorization already covers one or more of the selected schedules for this period.'
            );
        }

        $pendingConflicts = $this->findPendingConflicts(
            (int) $staff->id,
            $startDate,
            $endDate,
            $timetableIds,
            $authorizationType,
        );

        if ($pendingConflicts->isNotEmpty()) {
            throw new InvalidArgumentException(
                'A pending venue change request already covers one or more of the selected schedules for this period.'
            );
        }

        return DB::transaction(function () use ($staff, $data, $schedules, $authorizedClassroomId, $authorizationType, $startDate, $endDate) {
            $request = VenueChangeRequest::create([
                'staff_id' => $staff->id,
                'authorized_classroom_id' => $authorizedClassroomId,
                'authorization_type' => $authorizationType,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'start_time' => $data['start_time'] ?? null,
                'end_time' => $data['end_time'] ?? null,
                'reason' => $data['reason'],
                'notes' => $data['notes'] ?? null,
                'status' => VenueChangeRequest::STATUS_PENDING,
            ]);

            foreach ($schedules as $schedule) {
                VenueChangeRequestItem::create([
                    'venue_change_request_id' => $request->id,
                    'timetable_id' => $schedule->id,
                    'original_classroom_id' => $schedule->class_room_id,
                ]);
            }

            $this->activityLog->log(
                'venue_change_request_submitted',
                ActivityLogService::CATEGORY_ATTENDANCE,
                "Venue change request #{$request->id} submitted by administrator staff #{$staff->id} for {$request->period_label}.",
                metadata: [
                    'request_id' => $request->id,
                    'staff_id' => $staff->id,
                    'timetable_ids' => $schedules->pluck('id')->all(),
                    'authorized_classroom_id' => $authorizedClassroomId,
                    'authorization_type' => $authorizationType,
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'reason' => $request->reason,
                    'status' => VenueChangeRequest::STATUS_PENDING,
                ],
            );

            $this->notifyAdminsSubmitted($request->load(['staff', 'authorizedClassroom', 'items']));

            return $request->load(['staff', 'authorizedClassroom', 'items.timetable', 'items.originalClassroom']);
        });
    }

    public function approve(VenueChangeRequest $request, User $reviewer, ?string $comments = null): VenueChangeRequest
    {
        if (!$request->isPending()) {
            throw new InvalidArgumentException('Only pending venue change requests can be approved.');
        }

        return DB::transaction(function () use ($request, $reviewer, $comments) {
            $request->loadMissing('items');

            $timetableIds = $request->items->pluck('timetable_id')->map(fn ($id) => (int) $id)->all();

            $created = $this->authorizationService->createBulk([
                'staff_id' => $request->staff_id,
                'authorized_classroom_id' => $request->authorized_classroom_id,
                'authorization_type' => $request->authorization_type,
                'start_date' => $request->start_date->toDateString(),
                'end_date' => $request->end_date->toDateString(),
                'start_time' => $request->start_time,
                'end_time' => $request->end_time,
                'reason' => $request->reason,
                'notes' => $request->notes,
                'source_request_id' => $request->id,
            ], $timetableIds, $reviewer);

            $first = $created->first();

            $request->update([
                'status' => VenueChangeRequest::STATUS_APPROVED,
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
                'admin_comments' => $comments,
                'resulting_bulk_group_id' => $first?->bulk_group_id,
                'resulting_authorization_id' => $first?->id,
            ]);

            $this->activityLog->log(
                'venue_change_request_approved',
                ActivityLogService::CATEGORY_ATTENDANCE,
                "Venue change request #{$request->id} approved; created {$created->count()} authorization(s).",
                metadata: [
                    'request_id' => $request->id,
                    'staff_id' => $request->staff_id,
                    'reviewed_by' => $reviewer->id,
                    'admin_comments' => $comments,
                    'authorization_ids' => $created->pluck('id')->all(),
                    'bulk_group_id' => $first?->bulk_group_id,
                    'status' => VenueChangeRequest::STATUS_APPROVED,
                ],
            );

            $this->notifyStaffReviewed($request->fresh(['staff', 'authorizedClassroom']), approved: true);

            return $request->fresh([
                'staff',
                'authorizedClassroom',
                'reviewer',
                'items.timetable',
                'items.originalClassroom',
                'resultingAuthorization',
                'resultingAuthorizations',
            ]);
        });
    }

    public function reject(VenueChangeRequest $request, User $reviewer, ?string $comments = null): VenueChangeRequest
    {
        if (!$request->isPending()) {
            throw new InvalidArgumentException('Only pending venue change requests can be rejected.');
        }

        return DB::transaction(function () use ($request, $reviewer, $comments) {
            $request->update([
                'status' => VenueChangeRequest::STATUS_REJECTED,
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
                'admin_comments' => $comments,
            ]);

            $this->activityLog->log(
                'venue_change_request_rejected',
                ActivityLogService::CATEGORY_ATTENDANCE,
                "Venue change request #{$request->id} rejected.",
                metadata: [
                    'request_id' => $request->id,
                    'staff_id' => $request->staff_id,
                    'reviewed_by' => $reviewer->id,
                    'admin_comments' => $comments,
                    'status' => VenueChangeRequest::STATUS_REJECTED,
                ],
            );

            $this->notifyStaffReviewed($request->fresh(['staff']), approved: false);

            return $request->fresh([
                'staff',
                'authorizedClassroom',
                'reviewer',
                'items.timetable',
                'items.originalClassroom',
            ]);
        });
    }

    public function cancel(VenueChangeRequest $request, Teacher $staff): VenueChangeRequest
    {
        if ((int) $request->staff_id !== (int) $staff->id) {
            throw new InvalidArgumentException('You can only cancel your own venue change requests.');
        }

        if (!$request->isPending()) {
            throw new InvalidArgumentException('Only pending venue change requests can be cancelled.');
        }

        return DB::transaction(function () use ($request, $staff) {
            $request->update([
                'status' => VenueChangeRequest::STATUS_REJECTED,
                'admin_comments' => 'Cancelled by requester before review.',
                'reviewed_at' => now(),
            ]);

            $this->activityLog->log(
                'venue_change_request_cancelled',
                ActivityLogService::CATEGORY_ATTENDANCE,
                "Venue change request #{$request->id} cancelled by requester staff #{$staff->id}.",
                metadata: [
                    'request_id' => $request->id,
                    'staff_id' => $staff->id,
                    'status' => VenueChangeRequest::STATUS_REJECTED,
                ],
            );

            return $request->fresh(['staff', 'authorizedClassroom', 'items.timetable', 'items.originalClassroom']);
        });
    }

    /**
     * @param  array<int, int>  $timetableIds
     * @return Collection<int, VenueChangeRequest>
     */
    public function findPendingConflicts(
        int $staffId,
        string $startDate,
        string $endDate,
        array $timetableIds,
        string $authorizationType,
        ?int $exceptRequestId = null,
    ): Collection {
        return VenueChangeRequest::query()
            ->with('items')
            ->pending()
            ->where('staff_id', $staffId)
            ->when($exceptRequestId, fn ($q) => $q->where('id', '!=', $exceptRequestId))
            ->whereDate('start_date', '<=', $endDate)
            ->whereDate('end_date', '>=', $startDate)
            ->whereHas('items', fn ($q) => $q->whereIn('timetable_id', $timetableIds))
            ->get()
            ->filter(function (VenueChangeRequest $request) use ($authorizationType, $timetableIds) {
                if (!$this->typesOverlap($request->authorization_type, $authorizationType)) {
                    return false;
                }

                $overlap = $request->items->pluck('timetable_id')->intersect($timetableIds);

                return $overlap->isNotEmpty();
            })
            ->values();
    }

    private function typesOverlap(string $existing, string $incoming): bool
    {
        if ($existing === VenueChangeAuthorization::TYPE_BOTH || $incoming === VenueChangeAuthorization::TYPE_BOTH) {
            return true;
        }

        return $existing === $incoming;
    }

    private function notifyAdminsSubmitted(VenueChangeRequest $request): void
    {
        if (!filter_var(SystemSetting::getValue('notify_admin_venue_change_request_submitted', true), FILTER_VALIDATE_BOOLEAN)) {
            return;
        }

        $admins = User::query()
            ->permission('admin.venue-change-requests.manage')
            ->get();

        if ($admins->isEmpty()) {
            $admins = User::role('Super Admin')->get();
        }

        if ($admins->isEmpty()) {
            return;
        }

        Notification::send($admins, new AdminVenueChangeRequestSubmitted($request));
    }

    private function notifyStaffReviewed(VenueChangeRequest $request, bool $approved): void
    {
        $settingKey = $approved
            ? 'notify_venue_change_request_approved'
            : 'notify_venue_change_request_rejected';

        if (!filter_var(SystemSetting::getValue($settingKey, true), FILTER_VALIDATE_BOOLEAN)) {
            return;
        }

        $staff = $request->staff;
        if (!$staff instanceof Teacher) {
            return;
        }

        $venue = $request->authorizedClassroom?->name ?? 'requested venue';
        $period = $request->period_label;

        $this->notifications->notify($staff, LecturerNotificationPayload::make(
            type: $approved ? 'venue_change_request_approved' : 'venue_change_request_rejected',
            category: LecturerNotificationPayload::CATEGORY_ADMINISTRATIVE,
            priority: LecturerNotificationPayload::PRIORITY_HIGH,
            title: $approved ? 'Venue Change Request Approved' : 'Venue Change Request Rejected',
            message: $approved
                ? "Your venue change request was approved. You may mark attendance at {$venue} from {$period}."
                : 'Your venue change request was rejected.' . ($request->admin_comments ? ' Feedback: ' . $request->admin_comments : ''),
            url: '/teacher/venue-change-requests',
            meta: [
                'request_id' => $request->id,
                'status' => $request->status,
                'authorized_classroom_id' => $request->authorized_classroom_id,
                'start_date' => $request->start_date?->toDateString(),
                'end_date' => $request->end_date?->toDateString(),
                'period_label' => $period,
            ],
        ));
    }
}
