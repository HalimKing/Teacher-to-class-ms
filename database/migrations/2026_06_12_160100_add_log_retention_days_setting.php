<?php

use App\Models\SystemSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => 'log_retention_days'],
            [
                'value' => '90',
                'group' => 'general',
                'type' => 'integer',
                'description' => 'Number of days to retain system activity logs before automatic cleanup',
            ]
        );

        SystemSetting::clearCache();
    }

    public function down(): void
    {
        SystemSetting::query()->where('key', 'log_retention_days')->delete();
        SystemSetting::clearCache();
    }
};
