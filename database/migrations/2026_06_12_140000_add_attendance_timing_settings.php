<?php

use App\Models\SystemSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $settings = [
            [
                'key' => 'teacher_early_checkin_minutes',
                'value' => '30',
                'group' => 'attendance',
                'type' => 'integer',
                'description' => 'Number of minutes before scheduled start time that teachers are allowed to check in.',
            ],
            [
                'key' => 'checkout_grace_period_minutes',
                'value' => '30',
                'group' => 'attendance',
                'type' => 'integer',
                'description' => 'Number of minutes after scheduled end time that check-out is still considered compliant.',
            ],
        ];

        foreach ($settings as $setting) {
            SystemSetting::query()->updateOrCreate(
                ['key' => $setting['key']],
                [
                    'value' => $setting['value'],
                    'group' => $setting['group'],
                    'type' => $setting['type'],
                    'description' => $setting['description'],
                ]
            );
        }

        SystemSetting::clearCache();
    }

    public function down(): void
    {
        SystemSetting::query()->whereIn('key', [
            'teacher_early_checkin_minutes',
            'checkout_grace_period_minutes',
        ])->delete();

        SystemSetting::clearCache();
    }
};
