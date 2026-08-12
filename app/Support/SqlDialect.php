<?php

namespace App\Support;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

class SqlDialect
{
    public static function driver(?object $connection = null): string
    {
        return ($connection ?? DB::connection())->getDriverName();
    }

    /**
     * Portable concatenation that works on PostgreSQL and SQLite.
     *
     * @param  list<string>  $columns
     */
    public static function concat(array $columns, string $separator = ' '): string
    {
        $sep = str_replace("'", "''", $separator);
        $parts = array_map(
            fn (string $column) => "COALESCE({$column}, '')",
            $columns
        );

        return '(' . implode(" || '{$sep}' || ", $parts) . ')';
    }

    /**
     * @param  list<string>  $columns
     */
    public static function lowerConcat(array $columns, string $separator = ' '): string
    {
        return 'LOWER(' . self::concat($columns, $separator) . ')';
    }

    /**
     * Filter a date/timestamp column by weekday name (Sunday–Saturday).
     */
    public static function whereDayName(Builder $query, string $column, string $dayName): void
    {
        $days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        $dayIndex = array_search($dayName, $days, true);

        if ($dayIndex === false) {
            return;
        }

        $wrapped = $query->getGrammar()->wrap($column);
        $driver = $query->getConnection()->getDriverName();

        if ($driver === 'sqlite') {
            $query->whereRaw("CAST(strftime('%w', {$wrapped}) AS INTEGER) = ?", [$dayIndex]);

            return;
        }

        $query->whereRaw("EXTRACT(DOW FROM {$wrapped}) = ?", [$dayIndex]);
    }
}
