<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SystemSettingsUpdateRequest extends FormRequest
{
    /**
     * Allowed keys per group for validation.
     */
    private const GROUP_RULES = [
        'general' => [
            'institution_name' => 'nullable|string|max:255',
            'timezone'        => 'nullable|string|timezone|max:64',
            'date_format'     => 'nullable|string|max:32',
            'time_format'     => 'nullable|string|max:32',
        ],
        'attendance' => [
            'gps_radius_meters'           => 'nullable|integer|min:1|max:5000',
            'gps_enforcement_enabled'     => 'nullable|boolean',
            'late_check_in_minutes'       => 'nullable|integer|min:0|max:120',
            'early_leave_minutes'         => 'nullable|integer|min:0|max:120',
            'auto_mark_absent_after_end' => 'nullable|boolean',
            'allow_manual_override'       => 'nullable|boolean',
        ],
        'map' => [
            'google_maps_api_key'          => 'nullable|string|max:512',
            'default_campus_lat'          => 'nullable|numeric|between:-90,90',
            'default_campus_lng'          => 'nullable|numeric|between:-180,180',
            'max_check_in_distance_meters' => 'nullable|integer|min:1|max:5000',
            'validate_location_accuracy'   => 'nullable|boolean',
        ],
        'notifications' => [
            'attendance_logs_enabled' => 'nullable|boolean',
            'log_gps_attempts'        => 'nullable|boolean',
            'log_failed_attempts'    => 'nullable|boolean',
        ],
    ];

    // public function authorize(): bool
    // {
    //     return $this->user()?->can('admin.settings.edit') ?? false;
    // }

    public function rules(): array
    {
        $group = $this->input('group', 'general');
        $rules = self::GROUP_RULES[$group] ?? [];

        $out = [];
        foreach ($rules as $key => $rule) {
            $out["settings.{$key}"] = $rule;
        }
        return array_merge([
            'group' => ['required', 'string', Rule::in(array_keys(self::GROUP_RULES))],
        ], $out);
    }

    /**
     * Get validated settings array (key => value) for the submitted group.
     */
    public function getSettingsArray(): array
    {
        $settings = $this->validated('settings', []);
        $group = $this->validated('group');
        $allowed = array_keys(self::GROUP_RULES[$group] ?? []);
        $out = [];
        foreach ($allowed as $key) {
            if (array_key_exists($key, $settings)) {
                $out[$key] = $settings[$key];
            }
        }
        return $out;
    }
}
