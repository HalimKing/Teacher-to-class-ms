<?php

namespace App\Notifications;

use App\Models\RescheduledSession;
use App\Support\LecturerNotificationPayload;
use Carbon\Carbon;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class RescheduleStatusNotification extends Notification
{
    /**
     * @param  array<int, string>  $channels
     */
    public function __construct(
        public RescheduledSession $session,
        public string $status,
        public array $channels = ['database', 'mail'],
    ) {}

    public function via(object $notifiable): array
    {
        return $this->channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $this->session->loadMissing(['timetable.course', 'classroom']);

        $courseName = $this->session->timetable?->course?->name ?? 'your session';
        $approved = $this->status === 'approved';
        $subject = $approved
            ? 'Reschedule Request Approved'
            : 'Reschedule Request Rejected';

        $message = (new MailMessage)
            ->subject($subject)
            ->greeting('Hello ' . trim(($notifiable->title ?? '') . ' ' . ($notifiable->first_name ?? '')) . ',')
            ->line($approved
                ? "Your reschedule request for {$courseName} has been approved by the administration."
                : "Your reschedule request for {$courseName} has been rejected by the administration.");

        $message->line('Original session: ' . $this->formatSessionSlot(
            $this->session->original_date,
            $this->session->original_start_time,
            $this->session->original_end_time,
        ));

        $message->line('Requested session: ' . $this->formatSessionSlot(
            $this->session->new_date,
            $this->session->new_start_time,
            $this->session->new_end_time,
        ));

        if ($this->session->classroom?->name) {
            $message->line('Classroom: ' . $this->session->classroom->name);
        }

        if ($this->session->admin_remarks) {
            $message->line('Admin remarks: ' . $this->session->admin_remarks);
        }

        return $message
            ->action('View My Timetable', url('/teacher/timetable'))
            ->line('Thank you for using ' . config('app.name') . '!');
    }

    public function toArray(object $notifiable): array
    {
        $this->session->loadMissing(['timetable.course', 'classroom']);

        $courseName = $this->session->timetable?->course?->name ?? 'Session';
        $approved = $this->status === 'approved';

        return [
            'type' => 'reschedule_status',
            'category' => LecturerNotificationPayload::CATEGORY_TIMETABLE,
            'priority' => $approved ? LecturerNotificationPayload::PRIORITY_HIGH : LecturerNotificationPayload::PRIORITY_MEDIUM,
            'status' => $this->status,
            'reschedule_id' => $this->session->id,
            'title' => $approved ? 'Reschedule Request Approved' : 'Reschedule Request Rejected',
            'message' => $approved
                ? "Your reschedule request for {$courseName} was approved."
                : "Your reschedule request for {$courseName} was rejected.",
            'session' => $approved
                ? sprintf(
                    'Your %s class scheduled for %s at %s has been rescheduled to %s at %s.',
                    $courseName,
                    Carbon::parse($this->session->original_date)->format('l'),
                    $this->session->timetable?->classRoom?->name ?? 'the original venue',
                    Carbon::parse($this->session->new_date)->format('l'),
                    $this->session->classroom?->name ?? 'the new venue',
                )
                : $courseName . ' · ' . $this->formatSessionSlot(
                $this->session->new_date,
                $this->session->new_start_time,
                $this->session->new_end_time,
            ),
            'admin_remarks' => $this->session->admin_remarks,
            'url' => '/teacher/timetable',
        ];
    }

    private function formatSessionSlot(?string $date, ?string $start, ?string $end): string
    {
        $dateLabel = $date
            ? Carbon::parse($date)->format('l, M j, Y')
            : 'Date not set';

        $startLabel = $start ? substr($start, 0, 5) : '--:--';
        $endLabel = $end ? substr($end, 0, 5) : '--:--';

        return "{$dateLabel} ({$startLabel} - {$endLabel})";
    }
}
