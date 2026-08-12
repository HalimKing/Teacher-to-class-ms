<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

class ImportMysqlDatabaseCommand extends Command
{
    protected $signature = 'db:import-mysql
                            {--skip-migrate : Do not run PostgreSQL migrations before importing}
                            {--chunk=500 : Rows copied per batch}';

    protected $description = 'Copy data from a legacy MySQL database into the current PostgreSQL database';

    /**
     * @var list<string>
     */
    private array $skipTables = [
        'migrations',
        'cache',
        'cache_locks',
        'jobs',
        'job_batches',
        'failed_jobs',
        'sessions',
        'password_reset_tokens',
    ];

    public function handle(): int
    {
        $destination = DB::connection();

        if ($destination->getDriverName() !== 'pgsql') {
            $this->error('The default database connection must be pgsql. Current: '.$destination->getDriverName());

            return self::FAILURE;
        }

        if (! extension_loaded('pdo_mysql')) {
            $this->error('The pdo_mysql PHP extension is required to read the legacy MySQL database.');

            return self::FAILURE;
        }

        try {
            $source = DB::connection('mysql_import');
            $source->getPdo();
        } catch (Throwable $exception) {
            $this->error('Could not connect to the MySQL source (mysql_import). Check MYSQL_IMPORT_* environment variables.');
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        if ($source->getDatabaseName() === '' || $source->getDatabaseName() === null) {
            $this->error('MYSQL_IMPORT_DATABASE is not set.');

            return self::FAILURE;
        }

        if (! $this->option('skip-migrate')) {
            $this->info('Running PostgreSQL migrations…');
            $this->call('migrate', ['--force' => true]);
        }

        $sourceTables = array_map($this->normalizeTableName(...), $this->mysqlTables($source));
        $destinationTables = array_values(array_filter(
            array_map($this->normalizeTableName(...), Schema::getTableListing()),
            fn (string $table) => ! in_array($table, $this->skipTables, true)
        ));

        $tables = array_values(array_intersect($destinationTables, $sourceTables));
        $missingOnDestination = array_diff($sourceTables, $destinationTables, $this->skipTables);

        if ($missingOnDestination !== []) {
            $this->warn('Skipping MySQL tables that do not exist in PostgreSQL: '.implode(', ', $missingOnDestination));
        }

        if ($tables === []) {
            $this->error('No overlapping tables found to import.');

            return self::FAILURE;
        }

        if (! $this->confirm('This will replace data in '.count($tables).' PostgreSQL table(s). Continue?', true)) {
            return self::SUCCESS;
        }

        $chunk = max(1, (int) $this->option('chunk'));

        $destination->statement('SET session_replication_role = replica');

        try {
            $destination->statement(
                'TRUNCATE TABLE '.implode(', ', array_map(fn (string $table) => $this->quoteTable($table), $tables)).' RESTART IDENTITY'
            );

            foreach ($tables as $table) {
                $copied = $this->copyTable($source, $destination, $table, $chunk);
                $this->line("  {$table}: {$copied} row(s)");
            }

            $this->resetSequences($destination, $tables);
        } finally {
            $destination->statement('SET session_replication_role = origin');
        }

        $this->info('MySQL data imported into PostgreSQL. Sequences have been reset.');

        return self::SUCCESS;
    }

    /**
     * @return list<string>
     */
    private function mysqlTables(object $source): array
    {
        return collect($source->select("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'"))
            ->map(function ($row) {
                $values = array_values((array) $row);

                return $this->normalizeTableName((string) ($values[0] ?? ''));
            })
            ->filter()
            ->values()
            ->all();
    }

    private function normalizeTableName(string $table): string
    {
        $table = strtolower($table);

        if (str_contains($table, '.')) {
            $table = substr($table, strrpos($table, '.') + 1);
        }

        return $table;
    }

    private function copyTable(object $source, object $destination, string $table, int $chunk): int
    {
        $booleanColumns = $this->postgresColumnsOfType($destination, $table, ['boolean']);
        $jsonColumns = $this->postgresColumnsOfType($destination, $table, ['json', 'jsonb']);
        $copied = 0;
        $hasId = Schema::hasColumn($table, 'id');

        $query = $source->table($table);
        $callback = function ($rows) use ($destination, $table, $booleanColumns, $jsonColumns, &$copied) {
            $payload = [];

            foreach ($rows as $row) {
                $record = (array) $row;
                $payload[] = $this->normalizeRow($record, $booleanColumns, $jsonColumns);
            }

            if ($payload !== []) {
                $destination->table($table)->insert($payload);
                $copied += count($payload);
            }
        };

        if ($hasId) {
            $query->orderBy('id')->chunkById($chunk, $callback);
        } else {
            $query->orderByRaw('1')->chunk($chunk, $callback);
        }

        return $copied;
    }

    /**
     * @param  array<string, mixed>  $row
     * @param  list<string>  $booleanColumns
     * @param  list<string>  $jsonColumns
     * @return array<string, mixed>
     */
    private function normalizeRow(array $row, array $booleanColumns, array $jsonColumns): array
    {
        foreach ($booleanColumns as $column) {
            if (! array_key_exists($column, $row) || $row[$column] === null) {
                continue;
            }

            $row[$column] = filter_var($row[$column], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE)
                ?? (bool) $row[$column];
        }

        foreach ($jsonColumns as $column) {
            if (! array_key_exists($column, $row) || $row[$column] === null || $row[$column] === '') {
                continue;
            }

            if (is_string($row[$column])) {
                json_decode($row[$column], true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    $row[$column] = json_encode($row[$column]);
                }
            } elseif (is_array($row[$column]) || is_object($row[$column])) {
                $row[$column] = json_encode($row[$column]);
            }
        }

        foreach ($row as $column => $value) {
            if ($value === '0000-00-00' || $value === '0000-00-00 00:00:00') {
                $row[$column] = null;
            }
        }

        return $row;
    }

    /**
     * @param  list<string>  $types
     * @return list<string>
     */
    private function postgresColumnsOfType(object $connection, string $table, array $types): array
    {
        return $connection->table('information_schema.columns')
            ->where('table_schema', 'public')
            ->where('table_name', $table)
            ->whereIn('data_type', $types)
            ->pluck('column_name')
            ->map(fn ($name) => (string) $name)
            ->all();
    }

    /**
     * @param  list<string>  $tables
     */
    private function resetSequences(object $connection, array $tables): void
    {
        foreach ($tables as $table) {
            if (! Schema::hasColumn($table, 'id')) {
                continue;
            }

            $dataType = $connection->table('information_schema.columns')
                ->where('table_schema', 'public')
                ->where('table_name', $table)
                ->where('column_name', 'id')
                ->value('data_type');

            if (! in_array($dataType, ['bigint', 'integer', 'smallint'], true)) {
                continue;
            }

            $sequence = $connection->selectOne(
                'SELECT pg_get_serial_sequence(?, ?) AS seq',
                [$table, 'id']
            );

            if (! $sequence?->seq) {
                continue;
            }

            $quoted = $this->quoteTable($table);
            $connection->statement(
                "SELECT setval(?, COALESCE((SELECT MAX(id) FROM {$quoted}), 1), true)",
                [$sequence->seq]
            );
        }
    }

    private function quoteTable(string $table): string
    {
        return '"'.str_replace('"', '""', $table).'"';
    }
}
