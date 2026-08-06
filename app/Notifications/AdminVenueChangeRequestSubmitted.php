<?php

namespace App\Notifications;

use App\Models\VenueChangeRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AdminVenueChangeRequestSubmitted extends Notification
{
    use Queueable;

    public function __construct(public VenueChangeRequest $request) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $staff = $this->request->staff;
        $name = $staff
            ? trim("{$staff->title} {$staff->first_name} {$staff->last_name}")
            : 'An administrator';

        $venue = $this->request->authorizedClassroom?->name ?? 'a replacement venue';
        $schedules = $this->request->items?->count() ?? 0;

        return (new MailMessage)
            ->subject('New venue change request awaiting approval')
            ->greeting('Hello ' . ($notifiable->name ?? 'Admin') . ',')
            ->line("{$name} submitted a venue change request.")
            ->line("Requested venue: {$venue}")
            ->line('Period: ' . $this->request->period_label)
            ->line("Schedules: {$schedules}")
            ->line('Reason: ' . $this->request->reason)
            ->action('Review request', url('/admin/venue-change-requests/' . $this->request->id))
            ->line('Please approve or reject this request. It remains pending until reviewed.');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'venue_change_request_submitted',
            'request_id' => $this->request->id,
            'staff_id' => $this->request->staff_id,
            'status' => $this->request->status,
            'period_label' => $this->request->period_label,
            'url' => '/admin/venue-change-requests/' . $this->request->id,
        ];
    }
}
