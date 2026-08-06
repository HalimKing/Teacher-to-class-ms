<?php

namespace App\Notifications;

use App\Models\HelpDeskTicket;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AdminHelpDeskTicketSubmitted extends Notification
{
    use Queueable;

    public function __construct(public HelpDeskTicket $ticket) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $staff = $this->ticket->creator;
        $name = $staff
            ? trim("{$staff->title} {$staff->first_name} {$staff->last_name}")
            : 'A staff member';

        return (new MailMessage)
            ->subject('New help desk ticket: ' . $this->ticket->ticket_number)
            ->greeting('Hello ' . ($notifiable->name ?? 'Admin') . ',')
            ->line("{$name} submitted a new help desk ticket.")
            ->line('Ticket: ' . $this->ticket->ticket_number)
            ->line('Subject: ' . $this->ticket->subject)
            ->line('Category: ' . $this->ticket->categoryLabel())
            ->line('Priority: ' . $this->ticket->priorityLabel())
            ->action('Review ticket', url('/admin/help-desk/' . $this->ticket->id))
            ->line('Please review and respond as needed.');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'help_desk_ticket_submitted',
            'ticket_id' => $this->ticket->id,
            'ticket_number' => $this->ticket->ticket_number,
            'subject' => $this->ticket->subject,
            'priority' => $this->ticket->priority,
            'category' => $this->ticket->category,
            'url' => '/admin/help-desk/' . $this->ticket->id,
        ];
    }
}
