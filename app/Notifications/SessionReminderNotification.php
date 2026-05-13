<?php

namespace App\Notifications;

use App\Models\SessionReminder;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SessionReminderNotification extends Notification
{

    public function __construct(
        public SessionReminder $reminder
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $reminder = $this->reminder;
        $reminder->loadMissing('timetable.course', 'timetable.classRoom');

        $message = (new MailMessage)
            ->subject('Reminder: ' . $reminder->title)
            ->greeting('Hello ' . ($notifiable->first_name ?? $notifiable->name ?? '') . ',')
            ->line('This is a reminder you set: ' . $reminder->title)
            ->line('Scheduled for: ' . $reminder->reminder_at->format('l, F j, Y \a\t g:i A'));

        if ($reminder->message) {
            $message->line($reminder->message);
        }

        if ($reminder->timetable) {
            $session = $reminder->timetable;
            $message->line('Session: ' . ($session->course?->name ?? 'N/A') . ' – ' . $session->day . ' ' . substr($session->start_time ?? '', 0, 5));
            if ($session->classRoom) {
                $message->line('Room: ' . $session->classRoom->name);
            }
        }

        $message->action('View Reminders', url('/teacher/reminders'))
            ->line('Thank you for using ' . config('app.name') . '!');

        return $message;
    }

    /**
     * Get the array representation of the notification for database.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $reminder = $this->reminder;
        $reminder->loadMissing('timetable.course', 'timetable.classRoom');

        $sessionLine = null;
        if ($reminder->timetable) {
            $t = $reminder->timetable;
            $sessionLine = ($t->course?->name ?? '') . ' – ' . $t->day . ' ' . substr($t->start_time ?? '', 0, 5);
            if ($t->classRoom) {
                $sessionLine .= ' (' . $t->classRoom->name . ')';
            }
        }

        return [
            'type' => 'session_reminder',
            'reminder_id' => $reminder->id,
            'title' => $reminder->title,
            'message' => $reminder->message,
            'reminder_at' => $reminder->reminder_at->toIso8601String(),
            'session' => $sessionLine,
            'url' => '/teacher/reminders',
        ];
    }
}
