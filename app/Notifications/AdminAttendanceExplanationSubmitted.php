<?php

namespace App\Notifications;

use App\Models\AttendanceExplanation;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AdminAttendanceExplanationSubmitted extends Notification
{
    use Queueable;

    public function __construct(public AttendanceExplanation $explanation) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $staff = $this->explanation->staff;
        $name = $staff
            ? trim("{$staff->title} {$staff->first_name} {$staff->last_name}")
            : 'A staff member';

        return (new MailMessage)
            ->subject('New attendance explanation submitted')
            ->greeting('Hello ' . ($notifiable->name ?? 'Admin') . ',')
            ->line("{$name} submitted a {$this->explanation->explanation_type} explanation.")
            ->line('Category: ' . $this->explanation->reasonCategoryLabel())
            ->line('Date: ' . $this->explanation->attendance_date?->format('M j, Y'))
            ->action('Review explanation', url('/admin/attendance-explanations/' . $this->explanation->id))
            ->line('Please review and approve or reject the submission.');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'attendance_explanation_submitted',
            'explanation_id' => $this->explanation->id,
            'staff_id' => $this->explanation->staff_id,
            'explanation_type' => $this->explanation->explanation_type,
            'reason_category' => $this->explanation->reason_category,
            'url' => '/admin/attendance-explanations/' . $this->explanation->id,
        ];
    }
}
