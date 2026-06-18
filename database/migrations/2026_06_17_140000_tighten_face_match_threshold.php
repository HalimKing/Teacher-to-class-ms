<?php

use App\Models\SystemSetting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('system_settings')
            ->where('key', 'face_match_threshold')
            ->update([
                'value' => '0.45',
                'updated_at' => now(),
            ]);

        SystemSetting::clearCache();
    }

    public function down(): void
    {
        DB::table('system_settings')
            ->where('key', 'face_match_threshold')
            ->update([
                'value' => '0.6',
                'updated_at' => now(),
            ]);

        SystemSetting::clearCache();
    }
};
