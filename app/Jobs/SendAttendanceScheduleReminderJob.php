<?php

namespace App\Jobs;

use App\Models\AttendanceReminder;
use App\Models\AttendanceReminderDispatch;
use App\Models\Teacher;
use App\Models\TeacherNotificationPreference;
use App\Notifications\LecturerAlertNotification;
use App\Services\AttendanceReminderService;
use App\Services\SmsService;
use App\Support\LecturerNotificationPayload;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use RuntimeException;
use Throwable;

class SendAttendanceScheduleReminderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public int $dispatchId) {}

    public function handle(AttendanceReminderService $reminders): void
    {
        $dispatch = AttendanceReminderDispatch::query()
            ->with(['reminder', 'teacher', 'timetable.course', 'timetable.classRoom'])
            ->find($this->dispatchId);

        if (! $dispatch || $dispatch->status === AttendanceReminderDispatch::STATUS_SENT) {
            return;
        }

        $reminder = $dispatch->reminder;
        $teacher = $dispatch->teacher;

        if (! $reminder || ! $reminder->is_active || ! $teacher instanceof Teacher) {
            $dispatch->update([
                'status' => AttendanceReminderDispatch::STATUS_SKIPPED,
                'failure_reason' => 'The reminder is no longer active.',
            ]);

            return;
        }

        $preferences = TeacherNotificationPreference::forTeacher($teacher);

        if (! $preferences->isCategoryEnabled(LecturerNotificationPayload::CATEGORY_ATTENDANCE)) {
            $dispatch->update([
                'status' => AttendanceReminderDispatch::STATUS_SKIPPED,
                'failure_reason' => 'Attendance notifications are disabled for this staff member.',
            ]);

            return;
        }

        $sessionLabel = $dispatch->timetable?->course?->name ?? 'Scheduled session';
        $start = $dispatch->scheduled_for->copy();
        $message = $reminders->messageFor($reminder, []);
        $message .= ' Session: '.$sessionLabel
            .' on '.$dispatch->session_date?->format('l, M j, Y').'.';

        $via = $reminder->send_via ?: AttendanceReminder::VIA_BOTH;
        $wantsMail = in_array($via, [AttendanceReminder::VIA_MAIL, AttendanceReminder::VIA_BOTH], true);
        $wantsSms = in_array($via, [AttendanceReminder::VIA_SMS, AttendanceReminder::VIA_BOTH], true);
        $delivered = ['database'];
        $errors = [];

        $notification = new LecturerAlertNotification(
            LecturerNotificationPayload::make(
                type: 'attendance_schedule_reminder',
                category: LecturerNotificationPayload::CATEGORY_ATTENDANCE,
                priority: LecturerNotificationPayload::PRIORITY_HIGH,
                title: $reminder->title,
                message: $message,
                url: $teacher->isAdministrator() ? '/teacher/staff-attendance' : '/teacher/attendance',
                meta: [
                    'reminder_id' => $reminder->id,
                    'reminder_type' => $reminder->type,
                    'timetable_id' => $dispatch->timetable_id,
                    'scheduled_for' => $start->toIso8601String(),
                ],
            ),
            ['database'],
        );

        try {
            $teacher->notify($notification);
        } catch (Throwable $exception) {
            $errors[] = 'in-app: '.$exception->getMessage();
        }

        if ($wantsMail) {
            if (! $teacher->email) {
                $errors[] = 'mail: email is not available for this staff member';
            } else {
                try {
                    $teacher->notify(new LecturerAlertNotification($notification->payload, ['mail']));
                    $delivered[] = 'mail';
                } catch (Throwable $exception) {
                    $errors[] = 'mail: '.$exception->getMessage();
                }
            }
        }

        if ($wantsSms) {
            try {
                SmsService::send($teacher->phone, $reminder->title.': '.$message);
                $delivered[] = 'sms';
            } catch (Throwable $exception) {
                $errors[] = 'sms: '.$exception->getMessage();
            }
        }

        $externalRequested = ($wantsMail ? 1 : 0) + ($wantsSms ? 1 : 0);
        $externalDelivered = count(array_intersect($delivered, ['mail', 'sms']));

        if ($errors !== [] && $externalDelivered < $externalRequested) {
            $reason = implode(' | ', $errors);
            $dispatch->update([
                'status' => AttendanceReminderDispatch::STATUS_FAILED,
                'channel' => implode(',', $delivered),
                'failure_reason' => $reason,
            ]);

            if ($externalDelivered === 0) {
                throw new RuntimeException($reason);
            }

            return;
        }

        $dispatch->update([
            'status' => AttendanceReminderDispatch::STATUS_SENT,
            'notified_at' => now(),
            'channel' => implode(',', $delivered),
            'failure_reason' => null,
        ]);
    }

    public function failed(Throwable $exception): void
    {
        AttendanceReminderDispatch::query()
            ->whereKey($this->dispatchId)
            ->where('status', '!=', AttendanceReminderDispatch::STATUS_SENT)
            ->update([
                'status' => AttendanceReminderDispatch::STATUS_FAILED,
                'failure_reason' => $exception->getMessage(),
            ]);
    }
}
