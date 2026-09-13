<?php

namespace App\Notifications;

use App\Models\SelfReportedAbsenceReply;
use App\Models\Teacher;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SelfReportedAbsenceReplyPosted extends Notification
{
    use Queueable;

    /**
     * @param  array<string, mixed>  $details
     */
    public function __construct(
        public SelfReportedAbsenceReply $reply,
        public Teacher $author,
        public array $details,
    ) {}

    public function via(object $notifiable): array
    {
        return filled($notifiable->email ?? null) ? ['mail', 'database'] : ['database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $recipientName = trim(($notifiable->title ?? '').' '.($notifiable->first_name ?? '')) ?: 'there';

        return (new MailMessage)
            ->subject('Response to your self-reported absence')
            ->greeting('Hello '.$recipientName.',')
            ->line($this->author->displayName().' ('.$this->details['author_role'].') replied to your self-reported absence.')
            ->line('Attendance date: '.$this->details['date_display'])
            ->line('Session: '.$this->details['session_label'])
            ->line('Reply: '.$this->reply->body)
            ->action('View the reply', url($this->details['url']))
            ->line('You can review the full absence record in the staff portal.');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'self_reported_absence_reply',
            'category' => 'attendance',
            'title' => 'Reply to your absence',
            'message' => $this->author->displayName().' replied to your self-reported absence.',
            'url' => $this->details['url'],
            'reply_id' => $this->reply->id,
            'author_name' => $this->author->displayName(),
            'author_role' => $this->details['author_role'],
            'body' => $this->reply->body,
        ];
    }
}
