<?php

namespace App\Support;

class LecturerNotificationPayload
{
    public const CATEGORY_ATTENDANCE = 'attendance';
    public const CATEGORY_TIMETABLE = 'timetable';
    public const CATEGORY_SYSTEM = 'system';
    public const CATEGORY_ADMINISTRATIVE = 'administrative';

    public const PRIORITY_CRITICAL = 'critical';
    public const PRIORITY_HIGH = 'high';
    public const PRIORITY_MEDIUM = 'medium';
    public const PRIORITY_LOW = 'low';

    /**
     * @param  array<string, mixed>  $meta
     * @return array<string, mixed>
     */
    public static function make(
        string $type,
        string $category,
        string $priority,
        string $title,
        string $message,
        string $url = '/teacher/dashboard',
        array $meta = [],
    ): array {
        return [
            'type' => $type,
            'category' => $category,
            'priority' => $priority,
            'title' => $title,
            'message' => $message,
            'url' => $url,
            'meta' => $meta,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function normalize(array $data): array
    {
        return [
            'type' => $data['type'] ?? 'general',
            'category' => $data['category'] ?? self::CATEGORY_SYSTEM,
            'priority' => $data['priority'] ?? self::PRIORITY_MEDIUM,
            'title' => $data['title'] ?? 'Notification',
            'message' => $data['message'] ?? '',
            'url' => $data['url'] ?? '/teacher/dashboard',
            'meta' => $data['meta'] ?? [],
            'session' => $data['session'] ?? null,
            'status' => $data['status'] ?? null,
        ];
    }
}
