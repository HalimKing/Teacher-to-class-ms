<?php

namespace App\Notifications;

use App\Models\HelpDeskTicket;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AdminHelpDeskTicketUpdated extends Notification
{
    use Queueable;

    public function __construct(
        public HelpDeskTicket $ticket,
        public string $eventTitle = 'Help desk ticket updated',
        public string $eventMessage = 'A help desk ticket was updated.',
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject($this->eventTitle . ': ' . $this->ticket->ticket_number)
            ->greeting('Hello ' . ($notifiable->name ?? 'Admin') . ',')
            ->line($this->eventMessage)
            ->line('Ticket: ' . $this->ticket->ticket_number)
            ->line('Subject: ' . $this->ticket->subject)
            ->action('View ticket', url('/admin/help-desk/' . $this->ticket->id));
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'help_desk_ticket_updated',
            'ticket_id' => $this->ticket->id,
            'ticket_number' => $this->ticket->ticket_number,
            'subject' => $this->ticket->subject,
            'message' => $this->eventMessage,
            'url' => '/admin/help-desk/' . $this->ticket->id,
        ];
    }
}
