<?php

use App\Models\SystemSetting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('system_settings')->updateOrInsert(
            ['key' => 'facial_recognition_enabled'],
            [
                'value' => '1',
                'group' => 'attendance',
                'type' => 'boolean',
                'description' => 'Require facial recognition as an additional attendance verification layer.',
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        SystemSetting::clearCache();
    }

    public function down(): void
    {
        DB::table('system_settings')
            ->where('key', 'facial_recognition_enabled')
            ->update(['value' => '0', 'updated_at' => now()]);

        SystemSetting::clearCache();
    }
};
