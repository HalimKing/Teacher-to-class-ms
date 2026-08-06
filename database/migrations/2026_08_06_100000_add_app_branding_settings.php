<?php

use App\Models\SystemSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => 'app_name'],
            [
                'value' => 'UBIDS ATTENDANCE',
                'group' => 'general',
                'type' => 'string',
                'description' => 'Application display name shown in the header, login screens, and browser title.',
            ]
        );

        SystemSetting::query()->updateOrCreate(
            ['key' => 'app_logo'],
            [
                'value' => '/images/ubids-logo.png',
                'group' => 'general',
                'type' => 'string',
                'description' => 'Application logo image. Upload a new image below to replace the current logo.',
            ]
        );

        // Keep institution_name aligned for existing installs that still use it.
        SystemSetting::query()->where('key', 'institution_name')->update([
            'value' => 'University of Business and Integrated Development Studies',
            'description' => 'Institution / School name (optional organizational label).',
        ]);

        SystemSetting::clearCache();
    }

    public function down(): void
    {
        SystemSetting::query()->whereIn('key', ['app_name', 'app_logo'])->delete();
        SystemSetting::clearCache();
    }
};
