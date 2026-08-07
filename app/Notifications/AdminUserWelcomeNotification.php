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
        public string $temporaryPassword,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $appName = config('app.name');
        $roleList = implode(', ', $this->roles) ?: 'None';

        return (new MailMessage)
            ->subject('Your admin account on ' . $appName)
            ->markdown('mail.admin-user-welcome', [
                'appName' => $appName,
                'name' => $notifiable->name ?? 'there',
                'email' => $notifiable->email,
                'temporaryPassword' => $this->temporaryPassword,
                'roles' => $roleList,
                'createdByName' => $this->createdByName,
                'loginUrl' => url('/login'),
            ]);
    }
}
