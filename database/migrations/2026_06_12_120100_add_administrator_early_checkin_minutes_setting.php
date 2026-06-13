<?php

use App\Models\SystemSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => 'administrator_early_checkin_minutes'],
            [
                'value' => '30',
                'group' => 'attendance',
                'type' => 'integer',
                'description' => 'Number of minutes before scheduled start time that administrators are allowed to check in.',
            ]
        );

        SystemSetting::clearCache();
    }

    public function down(): void
    {
        SystemSetting::query()->where('key', 'administrator_early_checkin_minutes')->delete();
        SystemSetting::clearCache();
    }
};
