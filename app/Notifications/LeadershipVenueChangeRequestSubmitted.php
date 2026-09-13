<?php

namespace App\Notifications;

use App\Models\VenueChangeRequest;
use App\Support\LecturerNotificationPayload;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class LeadershipVenueChangeRequestSubmitted extends Notification
{
    use Queueable;

    /**
     * @param  array<string, mixed>  $details
     */
    public function __construct(
        public VenueChangeRequest $request,
        public array $details,
    ) {}

    public function via(object $notifiable): array
    {
        return filled($notifiable->email ?? null) ? ['mail', 'database'] : ['database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $recipientName = trim(($notifiable->title ?? '').' '.($notifiable->first_name ?? '')) ?: 'Supervisor';

        return (new MailMessage)
            ->subject('Venue change request awaiting your approval')
            ->greeting('Hello '.$recipientName.',')
            ->line($this->details['staff_name'].' submitted a venue change request that requires your review.')
            ->line('Staff member: '.$this->details['staff_name'])
            ->line('Current venue: '.$this->details['current_venue'])
            ->line('Requested venue: '.$this->details['requested_venue'])
            ->line('Attendance session: '.$this->details['session_label'])
            ->line('Period: '.$this->details['period_label'])
            ->line('Reason: '.$this->details['reason'])
            ->action('Review request', url($this->details['url']))
            ->line('This notice was sent because you are the assigned '.$this->details['supervisor_role'].'. The request stays pending until all required approvers have acted.');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return LecturerNotificationPayload::make(
            type: 'venue_change_request_submitted',
            category: LecturerNotificationPayload::CATEGORY_ADMINISTRATIVE,
            priority: LecturerNotificationPayload::PRIORITY_HIGH,
            title: 'Venue change request pending',
            message: $this->details['staff_name'].' requested a venue change to '.$this->details['requested_venue'].'.',
            url: $this->details['url'],
            meta: [
                'request_id' => $this->request->id,
                'staff_id' => $this->request->staff_id,
                'supervisor_role' => $this->details['supervisor_role'],
                'status' => $this->request->status,
            ],
        );
    }
}
