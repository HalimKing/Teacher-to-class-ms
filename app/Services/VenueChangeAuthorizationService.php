<?php

namespace App\Services;

use App\Models\ClassRoom;
use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Models\TimeTable;
use App\Models\User;
use App\Models\VenueChangeAuthorization;
use App\Support\LecturerNotificationPayload;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class VenueChangeAuthorizationService
{
    public function __construct(
        private ActivityLogService $activityLog,
        private LecturerNotificationService $notifications,
    ) {}

    /**
     * Create a single authorization (legacy / day-wide or one schedule).
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, User $approver): VenueChangeAuthorization
    {
        // Backwards-compatible mapping for single-date callers.
        if (empty($data['start_date']) && !empty($data['authorization_date'])) {
            $data['start_date'] = $data['authorization_date'];
            $data['end_date'] = $data['authorization_date'];
        }

        $created = $this->createMany([$data], $approver, bulkGroupId: null);

        return $created->first();
    }

    /**
     * Create one authorization per schedule, grouped under a shared bulk transaction id.
     *
     * @param  array<string, mixed>  $shared
     * @param  array<int, int>  $timetableIds
     * @return Collection<int, VenueChangeAuthorization>
     */
    public function createBulk(array $shared, array $timetableIds, User $approver): Collection
    {
        $timetableIds = array_values(array_unique(array_map('intval', $timetableIds)));

        if ($timetableIds === []) {
            throw new InvalidArgumentException('Select at least one schedule to authorize.');
        }

        $staffId = (int) $shared['staff_id'];
        $startDate = $shared['start_date'] ?? $shared['authorization_date'] ?? null;
        $endDate = $shared['end_date'] ?? $shared['authorization_date'] ?? null;

        if (!$startDate || !$endDate) {
            throw new InvalidArgumentException('Start date and end date are required.');
        }

        if (Carbon::parse($endDate)->lt(Carbon::parse($startDate))) {
            throw new InvalidArgumentException('End date cannot be earlier than start date.');
        }

        $authorizedClassroomId = (int) $shared['authorized_classroom_id'];

        $schedules = TimeTable::query()
            ->with('classRoom')
            ->whereIn('id', $timetableIds)
            ->get();

        if ($schedules->count() !== count($timetableIds)) {
            throw new InvalidArgumentException('One or more selected schedules could not be found.');
        }

        foreach ($schedules as $schedule) {
            if ((int) $schedule->teacher_id !== $staffId) {
                throw new InvalidArgumentException("Schedule #{$schedule->id} does not belong to the selected staff member.");
            }

            if (!$schedule->class_room_id) {
                throw new InvalidArgumentException("Schedule #{$schedule->id} has no assigned venue.");
            }

            if ((int) $schedule->class_room_id === $authorizedClassroomId) {
                throw new InvalidArgumentException(
                    "Replacement venue must differ from the original venue for schedule #{$schedule->id} ({$schedule->classRoom?->name})."
                );
            }
        }

        $conflicts = $this->findConflicts(
            $staffId,
            $startDate,
            $endDate,
            $timetableIds,
            $shared['authorization_type'],
        );

        if ($conflicts->isNotEmpty()) {
            $labels = $conflicts->map(function (VenueChangeAuthorization $auth) {
                $day = $auth->timetable?->day_of_week ?? $auth->timetable?->day ?? 'schedule';
                $start = $auth->timetable?->start_time ?? '';

                return trim("#{$auth->timetable_id} ({$day} {$start}) · {$auth->period_label}");
            })->implode(', ');

            throw new InvalidArgumentException(
                "Active or overlapping authorizations already exist for: {$labels}."
            );
        }

        $rows = $schedules->map(fn (TimeTable $schedule) => [
            'staff_id' => $staffId,
            'timetable_id' => $schedule->id,
            'original_classroom_id' => $schedule->class_room_id,
            'authorized_classroom_id' => $authorizedClassroomId,
            'authorization_type' => $shared['authorization_type'],
            'start_date' => $startDate,
            'end_date' => $endDate,
            'start_time' => $shared['start_time'] ?? null,
            'end_time' => $shared['end_time'] ?? null,
            'reason' => $shared['reason'],
            'notes' => $shared['notes'] ?? null,
        ])->all();

        $bulkGroupId = count($rows) > 1 ? (string) Str::uuid() : null;
        $sourceRequestId = isset($shared['source_request_id']) ? (int) $shared['source_request_id'] : null;

        return $this->createMany($rows, $approver, $bulkGroupId, $sourceRequestId);
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     * @return Collection<int, VenueChangeAuthorization>
     */
    private function createMany(array $rows, User $approver, ?string $bulkGroupId, ?int $sourceRequestId = null): Collection
    {
        return DB::transaction(function () use ($rows, $approver, $bulkGroupId, $sourceRequestId) {
            $created = collect();

            foreach ($rows as $data) {
                $startDate = $data['start_date'] ?? $data['authorization_date'] ?? null;
                $endDate = $data['end_date'] ?? $data['authorization_date'] ?? $startDate;

                $authorization = VenueChangeAuthorization::create([
                    'bulk_group_id' => $bulkGroupId,
                    'source_request_id' => $sourceRequestId,
                    'staff_id' => $data['staff_id'],
                    'timetable_id' => $data['timetable_id'] ?? null,
                    'original_classroom_id' => $data['original_classroom_id'],
                    'authorized_classroom_id' => $data['authorized_classroom_id'],
                    'authorization_type' => $data['authorization_type'],
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'start_time' => $data['start_time'] ?? null,
                    'end_time' => $data['end_time'] ?? null,
                    'reason' => $data['reason'],
                    'notes' => $data['notes'] ?? null,
                    'status' => VenueChangeAuthorization::STATUS_ACTIVE,
                    'approved_by' => $approver->id,
                    'approved_at' => now(),
                ]);

                $created->push($authorization);
            }

            $first = $created->first();
            $timetableIds = $created->pluck('timetable_id')->filter()->values()->all();

            $this->activityLog->log(
                $bulkGroupId ? 'venue_change_authorization_bulk_created' : 'venue_change_authorization_created',
                ActivityLogService::CATEGORY_ATTENDANCE,
                $bulkGroupId
                    ? "Bulk venue change authorization ({$created->count()} schedules) approved for staff #{$first->staff_id} for {$first->period_label}."
                    : "Venue change authorization #{$first->id} approved for staff #{$first->staff_id} for {$first->period_label}.",
                metadata: [
                    'bulk_group_id' => $bulkGroupId,
                    'source_request_id' => $sourceRequestId,
                    'authorization_ids' => $created->pluck('id')->all(),
                    'staff_id' => $first->staff_id,
                    'timetable_ids' => $timetableIds,
                    'authorized_classroom_id' => $first->authorized_classroom_id,
                    'authorization_type' => $first->authorization_type,
                    'start_date' => $first->start_date?->toDateString(),
                    'end_date' => $first->end_date?->toDateString(),
                    'period_label' => $first->period_label,
                    'reason' => $first->reason,
                    'schedule_count' => $created->count(),
                    'approved_by' => $approver->id,
                ],
            );

            // Request approvals send their own staff notification.
            if (!$sourceRequestId) {
                $this->notifyStaffApproved($first->load(['staff', 'authorizedClassroom']), $created->count());
            }

            return $created->map(
                fn (VenueChangeAuthorization $auth) => $auth->load([
                    'staff',
                    'originalClassroom',
                    'authorizedClassroom',
                    'approver',
                    'timetable',
                ])
            );
        });
    }

    /**
     * @param  array<int, int>  $timetableIds
     * @return Collection<int, VenueChangeAuthorization>
     */
    public function findConflicts(
        int $staffId,
        string $startDate,
        string $endDate,
        array $timetableIds,
        string $authorizationType,
    ): Collection {
        return VenueChangeAuthorization::query()
            ->with('timetable')
            ->active()
            ->where('staff_id', $staffId)
            ->overlappingPeriod($startDate, $endDate)
            ->whereIn('timetable_id', $timetableIds)
            ->get()
            ->filter(function (VenueChangeAuthorization $auth) use ($authorizationType) {
                return $this->typesOverlap($auth->authorization_type, $authorizationType);
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

    public function revoke(VenueChangeAuthorization $authorization, User $revoker, ?string $reason = null, bool $revokeBulkGroup = false): VenueChangeAuthorization
    {
        $targets = collect([$authorization]);

        if ($revokeBulkGroup && $authorization->bulk_group_id) {
            $targets = VenueChangeAuthorization::query()
                ->where('bulk_group_id', $authorization->bulk_group_id)
                ->active()
                ->get();
        }

        foreach ($targets as $target) {
            $target->update([
                'status' => VenueChangeAuthorization::STATUS_REVOKED,
                'revoked_by' => $revoker->id,
                'revoked_at' => now(),
                'revoke_reason' => $reason,
            ]);
        }

        $this->activityLog->log(
            $revokeBulkGroup && $authorization->bulk_group_id
                ? 'venue_change_authorization_bulk_revoked'
                : 'venue_change_authorization_revoked',
            ActivityLogService::CATEGORY_ATTENDANCE,
            $revokeBulkGroup && $authorization->bulk_group_id
                ? "Bulk venue change group {$authorization->bulk_group_id} revoked ({$targets->count()} records)."
                : "Venue change authorization #{$authorization->id} revoked.",
            metadata: [
                'authorization_id' => $authorization->id,
                'bulk_group_id' => $authorization->bulk_group_id,
                'authorization_ids' => $targets->pluck('id')->all(),
                'staff_id' => $authorization->staff_id,
                'start_date' => $authorization->start_date?->toDateString(),
                'end_date' => $authorization->end_date?->toDateString(),
                'period_label' => $authorization->period_label,
                'revoke_reason' => $reason,
            ],
        );

        return $authorization->fresh(['staff', 'originalClassroom', 'authorizedClassroom', 'approver', 'revoker']);
    }

    public function expireStale(?Carbon $reference = null): int
    {
        $reference ??= now();
        $today = $reference->toDateString();

        $expired = VenueChangeAuthorization::query()
            ->active()
            ->where(function ($query) use ($today, $reference) {
                $query->whereDate('end_date', '<', $today)
                    ->orWhere(function ($q) use ($today, $reference) {
                        $q->whereDate('end_date', $today)
                            ->whereNotNull('end_time')
                            ->where('end_time', '<', $reference->format('H:i:s'));
                    });
            })
            ->get();

        foreach ($expired as $authorization) {
            $authorization->update(['status' => VenueChangeAuthorization::STATUS_EXPIRED]);
            $this->activityLog->log(
                'venue_change_authorization_expired',
                ActivityLogService::CATEGORY_ATTENDANCE,
                "Venue change authorization #{$authorization->id} expired automatically.",
                metadata: [
                    'authorization_id' => $authorization->id,
                    'staff_id' => $authorization->staff_id,
                    'start_date' => $authorization->start_date?->toDateString(),
                    'end_date' => $authorization->end_date?->toDateString(),
                ],
            );
        }

        return $expired->count();
    }

    public function findActiveForStaff(
        int $staffId,
        Carbon $reference,
        string $action = 'check_in',
        ?int $timetableId = null,
    ): ?VenueChangeAuthorization {
        $this->expireStale($reference);

        $query = VenueChangeAuthorization::query()
            ->with(['authorizedClassroom', 'originalClassroom'])
            ->active()
            ->forStaffOnDate($staffId, $reference->toDateString())
            ->when($timetableId, fn ($q) => $q->where(function ($inner) use ($timetableId) {
                $inner->whereNull('timetable_id')->orWhere('timetable_id', $timetableId);
            }))
            // Prefer schedule-specific authorizations over day-wide ones.
            ->orderByRaw('CASE WHEN timetable_id IS NULL THEN 1 ELSE 0 END')
            ->orderByDesc('id');

        return $query->get()->first(function (VenueChangeAuthorization $auth) use ($reference, $action) {
            if (!$auth->isCurrentlyValid($reference)) {
                return false;
            }

            return $action === 'check_out' ? $auth->allowsCheckOut() : $auth->allowsCheckIn();
        });
    }

    /**
     * Resolve effective classroom coordinates for attendance UI / GPS.
     *
     * @return array{classroom: ClassRoom|null, authorization: VenueChangeAuthorization|null, authorized_venue_used: bool}
     */
    public function resolveEffectiveVenue(
        TimeTable $timetable,
        int $staffId,
        Carbon $reference,
        string $action = 'check_in',
    ): array {
        $authorization = $this->findActiveForStaff($staffId, $reference, $action, (int) $timetable->id);

        if ($authorization?->authorizedClassroom) {
            return [
                'classroom' => $authorization->authorizedClassroom,
                'authorization' => $authorization,
                'authorized_venue_used' => true,
            ];
        }

        return [
            'classroom' => $timetable->classRoom,
            'authorization' => null,
            'authorized_venue_used' => false,
        ];
    }

    private function notifyStaffApproved(VenueChangeAuthorization $authorization, int $scheduleCount = 1): void
    {
        if (!filter_var(SystemSetting::getValue('notify_venue_change_authorized', true), FILTER_VALIDATE_BOOLEAN)) {
            return;
        }

        $staff = $authorization->staff;
        if (!$staff instanceof Teacher) {
            return;
        }

        $venue = $authorization->authorizedClassroom?->name ?? 'authorized venue';
        $period = $authorization->period_label;
        $message = $scheduleCount > 1
            ? "You are authorized to mark attendance at {$venue} from {$period} for {$scheduleCount} schedules."
            : "You are authorized to mark attendance at {$venue} from {$period}.";

        $this->notifications->notify($staff, LecturerNotificationPayload::make(
            type: 'venue_change_authorized',
            category: LecturerNotificationPayload::CATEGORY_ADMINISTRATIVE,
            priority: LecturerNotificationPayload::PRIORITY_HIGH,
            title: 'Venue Change Authorized',
            message: $message,
            url: '/teacher/staff-attendance',
            meta: [
                'authorization_id' => $authorization->id,
                'bulk_group_id' => $authorization->bulk_group_id,
                'authorized_classroom_id' => $authorization->authorized_classroom_id,
                'start_date' => $authorization->start_date?->toDateString(),
                'end_date' => $authorization->end_date?->toDateString(),
                'period_label' => $period,
                'schedule_count' => $scheduleCount,
            ],
        ));
    }
}
