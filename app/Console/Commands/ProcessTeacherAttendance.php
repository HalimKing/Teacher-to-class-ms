<?php

namespace App\Console\Commands;

use App\Services\AttendanceProcessorService;
use Illuminate\Console\Command;

class ProcessTeacherAttendance extends Command
{
    protected $signature = 'attendance:process';

    protected $description = 'Finalize teacher and administrator attendance after the check-out grace period expires';

    public function __construct(
        private AttendanceProcessorService $processor
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $this->info('Processing attendance records for ' . now()->toDateTimeString());

        $stats = $this->processor->process();

        $this->reportRoleStats('Teachers', $stats['teachers']);
        $this->reportRoleStats('Administrators', $stats['administrators']);

        logger('Attendance processor completed', [
            'ran_at' => now()->toDateTimeString(),
            'stats' => $stats,
        ]);

        return self::SUCCESS;
    }

    private function reportRoleStats(string $label, array $stats): void
    {
        $this->line(sprintf(
            '%s: processed=%d absent=%d incomplete=%d finalized=%d skipped=%d',
            $label,
            $stats['processed'],
            $stats['absent'],
            $stats['incomplete'],
            $stats['finalized'],
            $stats['skipped'],
        ));
    }
}
