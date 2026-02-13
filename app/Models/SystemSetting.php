<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/**
 * System-wide settings stored as key-value pairs.
 * Use getValue() / setValue() for typed access; all settings can be cached.
 */
class SystemSetting extends Model
{
    protected $table = 'system_settings';

    protected $fillable = [
        'key',
        'value',
        'group',
        'type',
        'description',
    ];

    private const CACHE_KEY = 'system_settings';
    private const CACHE_TTL_SECONDS = 3600;

    /**
     * Get a single setting value by key (typed).
     */
    public static function getValue(string $key, mixed $default = null): mixed
    {
        $all = self::getAllCached();
        $setting = $all[$key] ?? null;
        if ($setting === null) {
            return $default;
        }
        return self::castValue($setting['value'], $setting['type']);
    }

    /**
     * Get all settings as associative array [ key => [ 'value' => ..., 'type' => ... ] ].
     */
    public static function getAllCached(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL_SECONDS, function () {
            $rows = self::query()->get();
            $out = [];
            foreach ($rows as $row) {
                $out[$row->key] = [
                    'value'  => $row->value,
                    'type'   => $row->type,
                    'group'  => $row->group,
                ];
            }
            return $out;
        });
    }

    /**
     * Get settings grouped by group key for admin UI.
     */
    public static function getGrouped(): array
    {
        $all = self::getAllCached();
        $grouped = [];
        foreach ($all as $key => $item) {
            $g = $item['group'];
            if (!isset($grouped[$g])) {
                $grouped[$g] = [];
            }
            $grouped[$g][$key] = [
                'key'   => $key,
                'value' => self::castValue($item['value'], $item['type']),
                'type'  => $item['type'],
            ];
        }
        return $grouped;
    }

    /**
     * Set a setting by key and clear cache.
     */
    public static function setValue(string $key, mixed $value): void
    {
        $row = self::query()->where('key', $key)->first();
        $serialized = self::serializeValue($value);
        $type = $row ? $row->type : 'string';

        if ($row) {
            $row->update(['value' => $serialized]);
        } else {
            self::query()->create([
                'key'   => $key,
                'value' => $serialized,
                'group' => 'general',
                'type'  => $type,
            ]);
        }
        Cache::forget(self::CACHE_KEY);
    }

    /**
     * Bulk update settings (keys must exist). Clears cache after.
     */
    public static function setMany(array $keyValues): void
    {
        foreach ($keyValues as $key => $value) {
            $row = self::query()->where('key', $key)->first();
            if ($row) {
                $row->update(['value' => self::serializeValue($value)]);
            }
        }
        Cache::forget(self::CACHE_KEY);
    }

    public static function clearCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    private static function castValue(?string $value, string $type): mixed
    {
        if ($value === null || $value === '') {
            return null;
        }
        return match ($type) {
            'integer' => (int) $value,
            'boolean' => filter_var($value, FILTER_VALIDATE_BOOLEAN),
            'json'    => json_decode($value, true),
            default   => $value,
        };
    }

    private static function serializeValue(mixed $value): string
    {
        if (is_bool($value)) {
            return $value ? '1' : '0';
        }
        if (is_array($value) || is_object($value)) {
            return json_encode($value);
        }
        return (string) $value;
    }
}
