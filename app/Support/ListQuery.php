<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class ListQuery
{
    public static function perPage(Request $request, int $default = 10): int
    {
        return min(max((int) $request->integer('per_page', $default), 5), 100);
    }

    public static function direction(Request $request, string $default = 'asc'): string
    {
        $dir = strtolower((string) $request->get('sort_dir', $request->get('sort_order', $default)));

        return $dir === 'desc' ? 'desc' : 'asc';
    }

    /**
     * @param  array<string, string|\Closure>  $allowed
     */
    public static function sortKey(Request $request, array $allowed, string $default): string
    {
        $key = (string) $request->get('sort_by', $default);

        return array_key_exists($key, $allowed) ? $key : $default;
    }

    /**
     * @param  Builder<\Illuminate\Database\Eloquent\Model>  $query
     * @param  array<string, string|\Closure>  $allowed
     * @return array{0: string, 1: string}
     */
    public static function applySort(Builder $query, Request $request, array $allowed, string $default): array
    {
        $key = self::sortKey($request, $allowed, $default);
        $dir = self::direction($request);
        $column = $allowed[$key];

        if ($column instanceof \Closure) {
            $column($query, $dir);
        } else {
            $query->orderBy($column, $dir);
        }

        return [$key, $dir];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public static function meta(array $filters, string $sortBy, string $sortDir, int $perPage): array
    {
        return array_merge($filters, [
            'sort_by' => $sortBy,
            'sort_dir' => $sortDir,
            'per_page' => (string) $perPage,
        ]);
    }
}
