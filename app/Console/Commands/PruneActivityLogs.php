<?php

namespace App\Console\Commands;

use App\Services\SystemLogService;
use Illuminate\Console\Command;

class PruneActivityLogs extends Command
{
    protected $signature = 'activity-logs:prune';

    protected $description = 'Remove activity logs older than the configured retention period';

    public function handle(SystemLogService $systemLogService): int
    {
        $deleted = $systemLogService->pruneExpiredLogs();
        $this->info("Pruned {$deleted} activity log record(s).");

        return self::SUCCESS;
    }
}
