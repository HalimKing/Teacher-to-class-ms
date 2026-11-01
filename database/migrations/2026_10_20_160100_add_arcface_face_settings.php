<?php

use App\Models\SystemSetting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $settings = [
            [
                'key' => 'face_recognition_engine',
                'value' => 'face_api',
                'group' => 'attendance',
                'type' => 'string',
                'description' => 'Recognition engine used for enrollment and attendance. Use arcface after the face service is running and staff have re-enrolled. face_api keeps the previous browser recognizer.',
            ],
            [
                'key' => 'arcface_match_threshold',
                'value' => '0.40',
                'group' => 'attendance',
                'type' => 'string',
                'description' => 'Minimum ArcFace cosine similarity accepted as a match. This is not the face-api.js distance threshold. Calibrate it with real samples from this deployment. A higher value is stricter.',
            ],
            [
                'key' => 'face_liveness_enabled',
                'value' => '1',
                'group' => 'attendance',
                'type' => 'boolean',
                'description' => 'Require a liveness check before ArcFace enrollment or verification. Software liveness reduces obvious photo spoofs and is not a perfect anti-spoofing guarantee.',
            ],
            [
                'key' => 'face_quality_threshold',
                'value' => '0.55',
                'group' => 'attendance',
                'type' => 'string',
                'description' => 'Minimum face quality score accepted by ArcFace enrollment and verification.',
            ],
            [
                'key' => 'face_service_timeout',
                'value' => '15',
                'group' => 'attendance',
                'type' => 'integer',
                'description' => 'Seconds Laravel waits for the face service before treating verification as unavailable.',
            ],
        ];

        foreach ($settings as $setting) {
            DB::table('system_settings')->updateOrInsert(
                ['key' => $setting['key']],
                array_merge($setting, ['created_at' => $now, 'updated_at' => $now])
            );
        }

        SystemSetting::clearCache();
    }

    public function down(): void
    {
        DB::table('system_settings')->whereIn('key', [
            'face_recognition_engine',
            'arcface_match_threshold',
            'face_liveness_enabled',
            'face_quality_threshold',
            'face_service_timeout',
        ])->delete();

        SystemSetting::clearCache();
    }
};
