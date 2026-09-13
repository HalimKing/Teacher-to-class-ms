<?php

namespace App\Notifications;

use App\Models\StaffAttendance;
use App\Models\Teacher;
use App\Models\TeacherAttendance;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SelfReportedAbsenceSubmitted extends Notification
{
    use Queueable;

    /**
     * @param  array<string, mixed>  $details
     */
    public function __construct(
        public Teacher $staff,
        public TeacherAttendance|StaffAttendance $attendance,
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
            ->subject('Self-reported absence: '.$this->staff->displayName())
            ->greeting('Hello '.$recipientName.',')
            ->line($this->staff->displayName().' has marked themselves absent for an attendance session.')
            ->line('Staff member: '.$this->staff->displayName())
            ->line('Role: '.$this->staff->staffTypeLabel())
            ->line('Attendance date: '.$this->details['date_display'])
            ->line('Session: '.$this->details['session_label'])
            ->line('Absence reason: '.$this->details['reason'])
            ->line('Submitted: '.$this->details['submitted_at_display'])
            ->action('View absence record', url($this->details['url']))
            ->line('This notice was sent because you are the assigned '.$this->details['supervisor_role'].'.');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'self_reported_absence_submitted',
            'category' => 'attendance',
            'title' => 'Self-reported absence',
            'message' => $this->staff->displayName().' marked themselves absent for '.$this->details['session_label'].'.',
            'url' => $this->details['url'],
            'staff_id' => $this->staff->id,
            'staff_name' => $this->staff->displayName(),
            'staff_role' => $this->staff->staffTypeLabel(),
            'attendance_kind' => $this->details['kind'],
            'attendance_id' => $this->attendance->id,
            'reason' => $this->details['reason'],
            'submitted_at' => $this->details['submitted_at'],
        ];
    }
}
