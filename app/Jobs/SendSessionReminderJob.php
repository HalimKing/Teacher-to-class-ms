<?php

namespace App\Jobs;

use App\Models\SessionReminder;
use App\Notifications\SessionReminderNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendSessionReminderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 3;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public int $sessionReminderId
    ) {}

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $reminder = SessionReminder::with('teacher', 'timetable.course', 'timetable.classRoom')
            ->find($this->sessionReminderId);

        if (! $reminder || $reminder->triggered_at !== null) {
            return;
        }

        // send via configured method
        $via = $reminder->send_via ?? 'mail';

        $sentAny = false;
        $errors = [];

        if ($via === 'mail' || $via === 'both') {
            try {
                $reminder->teacher->notify(new SessionReminderNotification($reminder));
                $sentAny = true;
            } catch (\Exception $e) {
                $errors[] = 'mail: ' . $e->getMessage();
                logger()->error('Error sending session reminder mail: ' . $e->getMessage());
            }
        }

        if ($via === 'sms' || $via === 'both') {
            try {
                \App\Services\SmsService::send(
                    $reminder->teacher->phone ?? null,
                    sprintf("Reminder: %s — %s", $reminder->title, $reminder->message ?? '')
                );
                $sentAny = true;
            } catch (\Exception $e) {
                $errors[] = 'sms: ' . $e->getMessage();
                logger()->error('Error sending session reminder SMS: ' . $e->getMessage());
            }
        }

        $update = ['triggered_at' => now()];
        if (empty($errors)) {
            $update['status'] = 'sent';
        } else {
            $update['status'] = 'failed';
            $update['error_message'] = implode(' | ', $errors);
        }

        $reminder->update($update);
    }
}
