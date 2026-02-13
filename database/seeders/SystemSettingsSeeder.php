<?php

namespace Database\Seeders;

use App\Models\SystemSetting;
use Illuminate\Database\Seeder;

/**
 * Seeds default system settings keys. Safe to run multiple times (upsert by key).
 */
class SystemSettingsSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = [
            // General
            ['key' => 'institution_name', 'value' => config('app.name', 'Teacher Attendance'), 'group' => 'general', 'type' => 'string', 'description' => 'Institution / School name'],
            ['key' => 'timezone', 'value' => config('app.timezone', 'UTC'), 'group' => 'general', 'type' => 'string', 'description' => 'Default time zone'],
            ['key' => 'date_format', 'value' => 'Y-m-d', 'group' => 'general', 'type' => 'string', 'description' => 'System date format'],
            ['key' => 'time_format', 'value' => 'H:i', 'group' => 'general', 'type' => 'string', 'description' => 'System time format'],

            // Attendance
            ['key' => 'gps_radius_meters', 'value' => '50', 'group' => 'attendance', 'type' => 'integer', 'description' => 'Default allowed GPS radius (meters) for attendance'],
            ['key' => 'gps_enforcement_enabled', 'value' => '1', 'group' => 'attendance', 'type' => 'boolean', 'description' => 'Enforce GPS location for check-in/check-out'],
            ['key' => 'late_check_in_minutes', 'value' => '15', 'group' => 'attendance', 'type' => 'integer', 'description' => 'Minutes after class start to count as late'],
            ['key' => 'early_leave_minutes', 'value' => '15', 'group' => 'attendance', 'type' => 'integer', 'description' => 'Minutes before class end to count as early leave'],
            ['key' => 'auto_mark_absent_after_end', 'value' => '0', 'group' => 'attendance', 'type' => 'boolean', 'description' => 'Auto-mark absent after class end time'],
            ['key' => 'allow_manual_override', 'value' => '1', 'group' => 'attendance', 'type' => 'boolean', 'description' => 'Allow admin to manually override attendance'],

            // Map & Location
            ['key' => 'google_maps_api_key', 'value' => '', 'group' => 'map', 'type' => 'string', 'description' => 'Google Maps API key (optional)'],
            ['key' => 'default_campus_lat', 'value' => '', 'group' => 'map', 'type' => 'string', 'description' => 'Default campus latitude'],
            ['key' => 'default_campus_lng', 'value' => '', 'group' => 'map', 'type' => 'string', 'description' => 'Default campus longitude'],
            ['key' => 'max_check_in_distance_meters', 'value' => '200', 'group' => 'map', 'type' => 'integer', 'description' => 'Maximum allowed distance for check-in (meters)'],
            ['key' => 'validate_location_accuracy', 'value' => '0', 'group' => 'map', 'type' => 'boolean', 'description' => 'Validate location accuracy threshold'],

            // Notifications & Logs
            ['key' => 'attendance_logs_enabled', 'value' => '1', 'group' => 'notifications', 'type' => 'boolean', 'description' => 'Enable attendance activity logs'],
            ['key' => 'log_gps_attempts', 'value' => '1', 'group' => 'notifications', 'type' => 'boolean', 'description' => 'Log GPS check-in/check-out attempts'],
            ['key' => 'log_failed_attempts', 'value' => '1', 'group' => 'notifications', 'type' => 'boolean', 'description' => 'Log failed attendance attempts'],
        ];

        foreach ($defaults as $item) {
            SystemSetting::query()->updateOrCreate(
                ['key' => $item['key']],
                [
                    'value'       => $item['value'],
                    'group'       => $item['group'],
                    'type'        => $item['type'],
                    'description' => $item['description'],
                ]
            );
        }

        SystemSetting::clearCache();
    }
}
