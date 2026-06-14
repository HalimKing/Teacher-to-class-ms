<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DiagnoseSessionCommand extends Command
{
    protected $signature = 'session:diagnose';

    protected $description = 'Check session/cookie configuration (useful for cPanel 419 debugging)';

    public function handle(): int
    {
        $this->info('Session diagnostics');
        $this->newLine();

        $this->table([], [
            ['APP_URL', config('app.url')],
            ['APP_KEY set', config('app.key') ? 'yes' : 'NO — sessions/CSRF will fail'],
            ['session.driver', config('session.driver')],
            ['session.domain', config('session.domain') ?? '(null — correct)'],
            ['session.secure', $this->formatNullable(config('session.secure'))],
            ['session.path', config('session.path')],
            ['session.cookie', config('session.cookie')],
        ]);

        $this->newLine();

        if (config('session.driver') === 'database') {
            try {
                DB::connection()->getPdo();
                $this->info('Database connection: OK');

                if (Schema::hasTable('sessions')) {
                    $count = DB::table('sessions')->count();
                    $this->info("sessions table: OK ({$count} rows)");
                } else {
                    $this->error('sessions table: MISSING — run php artisan migrate --force');
                }
            } catch (\Throwable $e) {
                $this->error('Database connection: FAILED — '.$e->getMessage());
            }
        }

        if (config('session.driver') === 'file') {
            $path = storage_path('framework/sessions');
            $writable = is_writable($path);
            $this->line('Session files path: '.$path);
            $this->line('Writable: '.($writable ? 'yes' : 'NO — fix storage permissions'));
        }

        if (file_exists(base_path('bootstrap/cache/config.php'))) {
            $this->warn('Config is cached. After .env changes run: php artisan config:clear && php artisan config:cache');
        }

        $this->newLine();
        $this->line('Expected cookie name in browser: '.config('session.cookie'));
        $this->line('On login GET, Network → Response Headers must include Set-Cookie.');

        return self::SUCCESS;
    }

    private function formatNullable(mixed $value): string
    {
        if ($value === null) {
            return '(null — auto-detect HTTPS)';
        }

        return $value ? 'true' : 'false';
    }
}
