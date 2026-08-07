<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TemporaryPasswordNotification extends Notification
{
    public function __construct(
        public string $temporaryPassword,
        public string $sharedByName,
        public string $loginUrl,
        public string $accountType = 'account',
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $appName = config('app.name');
        $name = $notifiable->name
            ?? trim(($notifiable->first_name ?? '') . ' ' . ($notifiable->last_name ?? ''))
            ?: 'there';

        return (new MailMessage)
            ->subject('Your temporary password for ' . $appName)
            ->markdown('mail.temporary-password', [
                'appName' => $appName,
                'name' => $name,
                'email' => $notifiable->email,
                'temporaryPassword' => $this->temporaryPassword,
                'sharedByName' => $this->sharedByName,
                'loginUrl' => $this->loginUrl,
                'accountType' => $this->accountType,
            ]);
    }
}
