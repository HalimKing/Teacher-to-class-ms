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
            ['key' => 'app_name', 'value' => 'UBIDS ATTENDANCE', 'group' => 'general', 'type' => 'string', 'description' => 'Application display name shown in the header, login screens, and browser title.'],
            ['key' => 'app_logo', 'value' => '/images/ubids-logo.png', 'group' => 'general', 'type' => 'string', 'description' => 'Application logo image. Upload a new image below to replace the current logo.'],
            ['key' => 'institution_name', 'value' => 'University of Business and Integrated Development Studies', 'group' => 'general', 'type' => 'string', 'description' => 'Institution / School name (optional organizational label).'],
            ['key' => 'timezone', 'value' => config('app.timezone', 'UTC'), 'group' => 'general', 'type' => 'string', 'description' => 'Default time zone'],
            ['key' => 'date_format', 'value' => 'Y-m-d', 'group' => 'general', 'type' => 'string', 'description' => 'System date format'],
            ['key' => 'time_format', 'value' => 'H:i', 'group' => 'general', 'type' => 'string', 'description' => 'System time format'],
            ['key' => 'log_retention_days', 'value' => '90', 'group' => 'general', 'type' => 'integer', 'description' => 'Number of days to retain activity logs'],

            // Attendance
            ['key' => 'gps_radius_meters', 'value' => '50', 'group' => 'attendance', 'type' => 'integer', 'description' => 'Default allowed GPS radius (meters) for attendance'],
            ['key' => 'gps_enforcement_enabled', 'value' => '1', 'group' => 'attendance', 'type' => 'boolean', 'description' => 'Enforce GPS location for check-in/check-out'],
            ['key' => 'late_check_in_minutes', 'value' => '15', 'group' => 'attendance', 'type' => 'integer', 'description' => 'Minutes after class start to count as late'],
            ['key' => 'administrator_early_checkin_minutes', 'value' => '30', 'group' => 'attendance', 'type' => 'integer', 'description' => 'Number of minutes before scheduled start time that administrators are allowed to check in.'],
            ['key' => 'teacher_early_checkin_minutes', 'value' => '30', 'group' => 'attendance', 'type' => 'integer', 'description' => 'Number of minutes before scheduled start time that teachers are allowed to check in.'],
            ['key' => 'checkout_grace_period_minutes', 'value' => '30', 'group' => 'attendance', 'type' => 'integer', 'description' => 'Number of minutes after scheduled end time that check-out is still considered compliant.'],
            ['key' => 'early_leave_minutes', 'value' => '15', 'group' => 'attendance', 'type' => 'integer', 'description' => 'Minutes before class end to count as early leave'],
            ['key' => 'auto_mark_absent_after_end', 'value' => '1', 'group' => 'attendance', 'type' => 'boolean', 'description' => 'Auto-mark absent after class end time'],
            ['key' => 'allow_manual_override', 'value' => '1', 'group' => 'attendance', 'type' => 'boolean', 'description' => 'Allow admin to manually override attendance'],
            ['key' => 'facial_recognition_enabled', 'value' => '1', 'group' => 'attendance', 'type' => 'boolean', 'description' => 'Require facial recognition as an additional attendance verification layer.'],
            ['key' => 'face_match_threshold', 'value' => '0.45', 'group' => 'attendance', 'type' => 'string', 'description' => 'Maximum descriptor distance accepted for a face match.'],
            ['key' => 'face_verification_timeout', 'value' => '120', 'group' => 'attendance', 'type' => 'integer', 'description' => 'Face verification token lifetime in seconds.'],
            ['key' => 'face_enrollment_required', 'value' => '0', 'group' => 'attendance', 'type' => 'boolean', 'description' => 'Block attendance when a lecturer has no enrolled face descriptor.'],
            ['key' => 'administrator_venue_change_requests_enabled', 'value' => '1', 'group' => 'attendance', 'type' => 'boolean', 'description' => 'When enabled, administrator staff can submit venue change requests for approval. When disabled, the request option is hidden and new submissions are blocked. Existing approved authorizations still work. Direct admin authorizations are unaffected.'],

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
            ['key' => 'notify_venue_change_authorized', 'value' => '1', 'group' => 'notifications', 'type' => 'boolean', 'description' => 'Notify staff when a venue change authorization is approved'],
            ['key' => 'notify_admin_venue_change_request_submitted', 'value' => '1', 'group' => 'notifications', 'type' => 'boolean', 'description' => 'Notify admins when an administrator submits a venue change request'],
            ['key' => 'notify_venue_change_request_approved', 'value' => '1', 'group' => 'notifications', 'type' => 'boolean', 'description' => 'Notify staff when their venue change request is approved'],
            ['key' => 'notify_venue_change_request_rejected', 'value' => '1', 'group' => 'notifications', 'type' => 'boolean', 'description' => 'Notify staff when their venue change request is rejected'],
            ['key' => 'notify_admin_explanation_submitted', 'value' => '1', 'group' => 'notifications', 'type' => 'boolean', 'description' => 'Notify admins when an absence or early departure explanation is submitted'],
            ['key' => 'notify_explanation_approved', 'value' => '1', 'group' => 'notifications', 'type' => 'boolean', 'description' => 'Notify staff when their attendance explanation is approved'],
            ['key' => 'notify_explanation_rejected', 'value' => '1', 'group' => 'notifications', 'type' => 'boolean', 'description' => 'Notify staff when their attendance explanation is rejected'],

            // Security
            ['key' => 'forgot_password_enabled', 'value' => '1', 'group' => 'security', 'type' => 'boolean', 'description' => 'Allow admin users and lecturers to request a password reset link from the login page.'],
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
