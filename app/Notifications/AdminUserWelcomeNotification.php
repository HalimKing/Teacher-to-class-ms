<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AdminUserWelcomeNotification extends Notification
{
    /**
     * @param  array<int, string>  $roles
     */
    public function __construct(
        public array $roles,
        public string $createdByName,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $roleList = implode(', ', $this->roles);

        return (new MailMessage)
            ->subject('Your admin account on ' . config('app.name'))
            ->greeting('Hello ' . ($notifiable->name ?? 'there') . ',')
            ->line('An administrator account has been created for you on ' . config('app.name') . '.')
            ->line('Assigned roles: ' . ($roleList ?: 'None'))
            ->line('Your administrator (' . $this->createdByName . ') will share your sign-in credentials securely.')
            ->line('You will be required to set a new password on first login.')
            ->action('Open Admin Login', url('/login'))
            ->line('If you did not expect this account, contact your system administrator immediately.');
    }
}
