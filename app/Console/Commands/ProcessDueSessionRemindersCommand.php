<?php

namespace App\Console\Commands;

use App\Jobs\SendSessionReminderJob;
use App\Models\SessionReminder;
use Illuminate\Console\Command;

class ProcessDueSessionRemindersCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'reminders:process';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Process due session reminders and send email/database notifications';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $due = SessionReminder::where('reminder_at', '<=', now())
            ->whereNull('triggered_at')
            ->whereIn('status', ['pending'])
            ->orderBy('reminder_at')
            ->get();

        $count = $due->count();
        if ($count === 0) {
            return self::SUCCESS;
        }

        $dispatched = 0;
        foreach ($due as $reminder) {
            $updated = SessionReminder::where('id', $reminder->id)
                ->where('status', 'pending')
                ->update(['status' => 'processing']);
            if ($updated) {
                SendSessionReminderJob::dispatch($reminder->id);
                $dispatched++;
            }
        }

        $this->info("Dispatched {$dispatched} session reminder(s).");

        return self::SUCCESS;
    }
}
