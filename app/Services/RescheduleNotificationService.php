<?php

namespace App\Services;

use App\Models\RescheduledSession;
use App\Models\TeacherNotificationPreference;
use App\Notifications\RescheduleStatusNotification;
use App\Support\LecturerNotificationPayload;
use Illuminate\Support\Facades\Log;

class RescheduleNotificationService
{
    public function notifyTeacher(RescheduledSession $session, string $status): void
    {
        $session->loadMissing(['teacher', 'timetable.course', 'classroom']);

        $teacher = $session->teacher;
        if (!$teacher) {
            Log::warning('Reschedule notification skipped: teacher missing.', [
                'reschedule_id' => $session->id,
                'teacher_id' => $session->teacher_id,
            ]);

            return;
        }

        $preferences = TeacherNotificationPreference::forTeacher($teacher);
        if (!$preferences->isCategoryEnabled(LecturerNotificationPayload::CATEGORY_TIMETABLE)) {
            return;
        }

        try {
            $teacher->notify(new RescheduleStatusNotification($session, $status, ['database']));
        } catch (\Throwable $e) {
            Log::error('Failed to store reschedule dashboard notification.', [
                'reschedule_id' => $session->id,
                'teacher_id' => $teacher->id,
                'status' => $status,
                'error' => $e->getMessage(),
            ]);
        }

        if (empty($teacher->email) || !$preferences->email_enabled) {
            Log::warning('Reschedule email skipped: teacher email missing.', [
                'reschedule_id' => $session->id,
                'teacher_id' => $teacher->id,
            ]);

            return;
        }

        try {
            $teacher->notify(new RescheduleStatusNotification($session, $status, ['mail']));
        } catch (\Throwable $e) {
            Log::error('Failed to send reschedule email notification.', [
                'reschedule_id' => $session->id,
                'teacher_id' => $teacher->id,
                'status' => $status,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
