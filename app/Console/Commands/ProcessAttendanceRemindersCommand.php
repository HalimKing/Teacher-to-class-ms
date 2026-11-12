<?php

namespace App\Console\Commands;

use App\Services\AttendanceReminderService;
use Illuminate\Console\Command;

class ProcessAttendanceRemindersCommand extends Command
{
    protected $signature = 'attendance-reminders:process';

    protected $description = 'Send due timetable attendance reminders. Active reminders repeat until an administrator disables or deletes them.';

    public function handle(AttendanceReminderService $reminders): int
    {
        $queued = $reminders->processDue(now());

        $this->info("Queued {$queued} attendance reminder notification(s).");

        return self::SUCCESS;
    }
}
