<?php

namespace App\Notifications;

use App\Support\LecturerNotificationPayload;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class LecturerAlertNotification extends Notification
{
    /**
     * @param  array<string, mixed>  $payload
     * @param  array<int, string>  $channels
     */
    public function __construct(
        public array $payload,
        public array $channels = ['database', 'mail'],
    ) {}

    public function via(object $notifiable): array
    {
        return $this->channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $data = LecturerNotificationPayload::normalize($this->payload);

        return (new MailMessage)
            ->subject($data['title'])
            ->greeting('Hello ' . trim(($notifiable->title ?? '') . ' ' . ($notifiable->first_name ?? '')) . ',')
            ->line($data['message'])
            ->action('Open Portal', url($data['url']))
            ->line('Thank you for using ' . config('app.name') . '!');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return LecturerNotificationPayload::normalize($this->payload);
    }
}
