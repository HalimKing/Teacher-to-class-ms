<?php

namespace App\Notifications;

use App\Models\SessionReminder;
use App\Services\RescheduledAttendanceService;
use App\Support\LecturerNotificationPayload;
use Carbon\Carbon;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SessionReminderNotification extends Notification
{
    public function __construct(
        public SessionReminder $reminder
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $reminder = $this->reminder;
        $reminder->loadMissing('timetable.course', 'timetable.classRoom');
        $sessionDetails = $this->resolveSessionDetails();

        $message = (new MailMessage)
            ->subject('Reminder: ' . $reminder->title)
            ->greeting('Hello ' . ($notifiable->first_name ?? $notifiable->name ?? '') . ',')
            ->line('This is a reminder you set: ' . $reminder->title)
            ->line('Scheduled for: ' . $reminder->reminder_at->format('l, F j, Y \a\t g:i A'));

        if ($reminder->message) {
            $message->line($reminder->message);
        }

        if ($reminder->timetable) {
            $message->line('Session: ' . ($reminder->timetable->course?->name ?? 'N/A'));
            $message->line('When: ' . $sessionDetails['date_display'] . ' • ' . $sessionDetails['start_time_display'] . ' – ' . $sessionDetails['end_time_display']);

            if ($sessionDetails['venue']) {
                $message->line('Venue: ' . $sessionDetails['venue']);
            }

            if ($sessionDetails['is_rescheduled'] && !empty($sessionDetails['reschedule']['rescheduled_from_badge'])) {
                $message->line($sessionDetails['reschedule']['rescheduled_from_badge']);
            }
        }

        $message->action('View Reminders', url('/teacher/reminders'))
            ->line('Thank you for using ' . config('app.name') . '!');

        return $message;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $reminder = $this->reminder;
        $reminder->loadMissing('timetable.course', 'timetable.classRoom');
        $sessionDetails = $this->resolveSessionDetails();

        $sessionLine = null;
        if ($reminder->timetable) {
            $sessionLine = ($reminder->timetable->course?->name ?? 'Session')
                . ' – ' . $sessionDetails['date_display']
                . ' ' . $sessionDetails['start_time_display'];

            if ($sessionDetails['venue']) {
                $sessionLine .= ' (' . $sessionDetails['venue'] . ')';
            }

            if ($sessionDetails['is_rescheduled'] && !empty($sessionDetails['reschedule']['rescheduled_from_badge'])) {
                $sessionLine .= ' • ' . $sessionDetails['reschedule']['rescheduled_from_badge'];
            }
        }

        return [
            'type' => 'session_reminder',
            'category' => LecturerNotificationPayload::CATEGORY_ATTENDANCE,
            'priority' => LecturerNotificationPayload::PRIORITY_MEDIUM,
            'reminder_id' => $reminder->id,
            'title' => $reminder->title,
            'message' => $reminder->message,
            'reminder_at' => $reminder->reminder_at->toIso8601String(),
            'session' => $sessionLine,
            'url' => '/teacher/reminders',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function resolveSessionDetails(): array
    {
        $reminder = $this->reminder;

        if (!$reminder->timetable) {
            return [
                'date_display' => $reminder->reminder_at->format('l, F j, Y'),
                'start_time_display' => $reminder->reminder_at->format('g:i A'),
                'end_time_display' => '',
                'venue' => null,
                'is_rescheduled' => false,
                'reschedule' => null,
            ];
        }

        return app(RescheduledAttendanceService::class)
            ->resolveEffectiveSessionDetails($reminder->timetable, Carbon::parse($reminder->reminder_at));
    }
}
