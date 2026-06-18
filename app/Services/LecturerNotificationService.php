<?php

namespace App\Services;

use App\Models\Teacher;
use App\Models\TeacherNotificationPreference;
use App\Notifications\LecturerAlertNotification;
use App\Support\LecturerNotificationPayload;
use Illuminate\Support\Facades\Log;

class LecturerNotificationService
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function notify(Teacher $teacher, array $payload, ?bool $sendEmail = null): void
    {
        $payload = LecturerNotificationPayload::normalize($payload);
        $preferences = TeacherNotificationPreference::forTeacher($teacher);

        if (!$preferences->isCategoryEnabled((string) $payload['category'])) {
            return;
        }

        $shouldEmail = $sendEmail ?? $preferences->email_enabled;

        try {
            $teacher->notify(new LecturerAlertNotification($payload, ['database']));
        } catch (\Throwable $e) {
            Log::error('Failed to store lecturer notification.', [
                'teacher_id' => $teacher->id,
                'type' => $payload['type'] ?? null,
                'error' => $e->getMessage(),
            ]);
        }

        if (!$shouldEmail || empty($teacher->email)) {
            return;
        }

        try {
            $teacher->notify(new LecturerAlertNotification($payload, ['mail']));
        } catch (\Throwable $e) {
            Log::error('Failed to email lecturer notification.', [
                'teacher_id' => $teacher->id,
                'type' => $payload['type'] ?? null,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function mapNotifications($notifications): array
    {
        return $notifications->map(function ($notification) {
            return [
                'id' => $notification->id,
                'type' => $notification->type,
                'data' => LecturerNotificationPayload::normalize($notification->data ?? []),
                'read_at' => $notification->read_at?->toIso8601String(),
                'created_at' => $notification->created_at->toIso8601String(),
            ];
        })->values()->all();
    }
}
