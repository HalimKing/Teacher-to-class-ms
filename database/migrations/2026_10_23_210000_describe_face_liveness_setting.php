<?php

use App\Models\SystemSetting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('system_settings')
            ->where('key', 'face_liveness_enabled')
            ->update([
                'description' => 'Prevents attendance verification using photographs and other supported spoofing attempts by checking whether a live person is present in front of the camera.',
                'updated_at' => now(),
            ]);

        SystemSetting::clearCache();
    }

    public function down(): void
    {
        DB::table('system_settings')
            ->where('key', 'face_liveness_enabled')
            ->update([
                'description' => 'Require a liveness check before ArcFace enrollment or verification. Software liveness reduces obvious photo spoofs and is not a perfect anti-spoofing guarantee.',
                'updated_at' => now(),
            ]);

        SystemSetting::clearCache();
    }
};
