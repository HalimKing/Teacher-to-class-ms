<?php

namespace App\Services;

use App\Models\AttendanceExplanation;
use App\Models\StaffAttendance;
use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Models\TeacherAttendance;
use App\Models\User;
use App\Notifications\AdminAttendanceExplanationSubmitted;
use App\Support\AttendanceExceptionCategory;
use App\Support\LecturerNotificationPayload;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

class AttendanceExplanationService
{
    public function __construct(
        private ActivityLogService $activityLog,
        private LecturerNotificationService $notifications,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function submit(Teacher $staff, array $data, ?UploadedFile $document = null): AttendanceExplanation
    {
        return DB::transaction(function () use ($staff, $data, $document) {
            $existing = AttendanceExplanation::query()
                ->where('attendance_type', $data['attendance_type'])
                ->where('attendance_id', $data['attendance_id'])
                ->where('explanation_type', $data['explanation_type'])
                ->whereIn('status', [AttendanceExplanation::STATUS_PENDING, AttendanceExplanation::STATUS_APPROVED])
                ->first();

            if ($existing) {
                throw new \InvalidArgumentException('An explanation has already been submitted for this attendance record.');
            }

            $documentPath = null;
            $documentName = null;
            if ($document) {
                $documentPath = $document->store('attendance-explanations', 'public');
                $documentName = $document->getClientOriginalName();
            }

            $explanation = AttendanceExplanation::create([
                'staff_id' => $staff->id,
                'attendance_type' => $data['attendance_type'],
                'attendance_id' => $data['attendance_id'],
                'timetable_id' => $data['timetable_id'] ?? null,
                'attendance_date' => $data['attendance_date'],
                'explanation_type' => $data['explanation_type'],
                'reason_category' => $data['reason_category'],
                'explanation' => $data['explanation'],
                'supporting_document_path' => $documentPath,
                'supporting_document_name' => $documentName,
                'status' => AttendanceExplanation::STATUS_PENDING,
            ]);

            $this->markAttendancePendingReview($explanation);

            $this->activityLog->log(
                'attendance_explanation_submitted',
                ActivityLogService::CATEGORY_ATTENDANCE,
                "Attendance explanation #{$explanation->id} submitted by staff #{$staff->id}.",
                metadata: [
                    'explanation_id' => $explanation->id,
                    'explanation_type' => $explanation->explanation_type,
                    'reason_category' => $explanation->reason_category,
                    'attendance_type' => $explanation->attendance_type,
                    'attendance_id' => $explanation->attendance_id,
                ],
            );

            $this->notifyAdminsSubmitted($explanation);

            return $explanation->load(['staff', 'timetable']);
        });
    }

    public function approve(
        AttendanceExplanation $explanation,
        User $reviewer,
        ?string $comments = null,
        bool $updateAttendanceStatus = true,
    ): AttendanceExplanation {
        return DB::transaction(function () use ($explanation, $reviewer, $comments, $updateAttendanceStatus) {
            $statusApplied = null;

            if ($updateAttendanceStatus) {
                $statusApplied = $this->applyApprovedStatus($explanation);
            }

            $explanation->update([
                'status' => AttendanceExplanation::STATUS_APPROVED,
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
                'admin_comments' => $comments,
                'status_applied' => $statusApplied,
            ]);

            $this->activityLog->log(
                'attendance_explanation_approved',
                ActivityLogService::CATEGORY_ATTENDANCE,
                "Attendance explanation #{$explanation->id} approved.",
                metadata: [
                    'explanation_id' => $explanation->id,
                    'status_applied' => $statusApplied,
                    'comments' => $comments,
                ],
            );

            $this->notifyStaffReviewed($explanation->fresh(['staff']), approved: true);

            return $explanation->fresh(['staff', 'reviewer', 'timetable']);
        });
    }

    public function reject(
        AttendanceExplanation $explanation,
        User $reviewer,
        ?string $comments = null,
    ): AttendanceExplanation {
        return DB::transaction(function () use ($explanation, $reviewer, $comments) {
            $explanation->update([
                'status' => AttendanceExplanation::STATUS_REJECTED,
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
                'admin_comments' => $comments,
            ]);

            $this->activityLog->log(
                'attendance_explanation_rejected',
                ActivityLogService::CATEGORY_ATTENDANCE,
                "Attendance explanation #{$explanation->id} rejected.",
                metadata: [
                    'explanation_id' => $explanation->id,
                    'comments' => $comments,
                ],
            );

            $this->notifyStaffReviewed($explanation->fresh(['staff']), approved: false);

            return $explanation->fresh(['staff', 'reviewer', 'timetable']);
        });
    }

    private function markAttendancePendingReview(AttendanceExplanation $explanation): void
    {
        $record = $explanation->attendanceRecord();
        if (!$record) {
            return;
        }

        if ($explanation->explanation_type === AttendanceExplanation::TYPE_ABSENCE) {
            $record->update([
                'exception_category' => AttendanceExceptionCategory::UNEXCUSED_ABSENCE,
            ]);
        }

        if ($explanation->explanation_type === AttendanceExplanation::TYPE_EARLY_DEPARTURE) {
            $record->update([
                'exception_category' => AttendanceExceptionCategory::UNAUTHORIZED_EARLY_DEPARTURE,
            ]);
        }
    }

    private function applyApprovedStatus(AttendanceExplanation $explanation): ?string
    {
        $record = $explanation->attendanceRecord();
        if (!$record) {
            return null;
        }

        if ($explanation->explanation_type === AttendanceExplanation::TYPE_ABSENCE) {
            if ($record instanceof StaffAttendance) {
                $record->update([
                    'attendance_status' => 'excused_absence',
                    'exception_category' => AttendanceExceptionCategory::EXCUSED_ABSENCE,
                ]);
            } elseif ($record instanceof TeacherAttendance) {
                $record->update([
                    'status' => 'absent',
                    'exception_category' => AttendanceExceptionCategory::EXCUSED_ABSENCE,
                ]);
            }

            return AttendanceExceptionCategory::EXCUSED_ABSENCE;
        }

        $record->update([
            'exception_category' => AttendanceExceptionCategory::AUTHORIZED_EARLY_DEPARTURE,
        ]);

        return AttendanceExceptionCategory::AUTHORIZED_EARLY_DEPARTURE;
    }

    private function notifyAdminsSubmitted(AttendanceExplanation $explanation): void
    {
        if (!filter_var(SystemSetting::getValue('notify_admin_explanation_submitted', true), FILTER_VALIDATE_BOOLEAN)) {
            return;
        }

        $admins = User::query()
            ->permission('admin.attendance-explanations.manage')
            ->get();

        if ($admins->isEmpty()) {
            $admins = User::role('Super Admin')->get();
        }

        if ($admins->isEmpty()) {
            return;
        }

        Notification::send($admins, new AdminAttendanceExplanationSubmitted($explanation));
    }

    private function notifyStaffReviewed(AttendanceExplanation $explanation, bool $approved): void
    {
        $settingKey = $approved
            ? 'notify_explanation_approved'
            : 'notify_explanation_rejected';

        if (!filter_var(SystemSetting::getValue($settingKey, true), FILTER_VALIDATE_BOOLEAN)) {
            return;
        }

        $staff = $explanation->staff;
        if (!$staff) {
            return;
        }

        $this->notifications->notify($staff, LecturerNotificationPayload::make(
            type: $approved ? 'attendance_explanation_approved' : 'attendance_explanation_rejected',
            category: LecturerNotificationPayload::CATEGORY_ATTENDANCE,
            priority: LecturerNotificationPayload::PRIORITY_HIGH,
            title: $approved ? 'Explanation Approved' : 'Explanation Rejected',
            message: $approved
                ? 'Your attendance explanation was approved.'
                : 'Your attendance explanation was rejected.' . ($explanation->admin_comments ? ' Feedback: ' . $explanation->admin_comments : ''),
            url: '/teacher/attendance-explanations',
            meta: [
                'explanation_id' => $explanation->id,
                'status' => $explanation->status,
            ],
        ));
    }
}
