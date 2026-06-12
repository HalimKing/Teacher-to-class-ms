<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $now = now();
        $settings = [
            [
                'key' => 'facial_recognition_enabled',
                'value' => '0',
                'group' => 'attendance',
                'type' => 'boolean',
                'description' => 'Require facial recognition as an additional attendance verification layer.',
            ],
            [
                'key' => 'face_match_threshold',
                'value' => '0.6',
                'group' => 'attendance',
                'type' => 'string',
                'description' => 'Maximum descriptor distance accepted for a face match.',
            ],
            [
                'key' => 'face_verification_timeout',
                'value' => '120',
                'group' => 'attendance',
                'type' => 'integer',
                'description' => 'Face verification token lifetime in seconds.',
            ],
            [
                'key' => 'face_enrollment_required',
                'value' => '0',
                'group' => 'attendance',
                'type' => 'boolean',
                'description' => 'Block attendance when a lecturer has no enrolled face descriptor.',
            ],
        ];

        foreach ($settings as $setting) {
            DB::table('system_settings')->updateOrInsert(
                ['key' => $setting['key']],
                array_merge($setting, ['created_at' => $now, 'updated_at' => $now])
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('system_settings')
            ->whereIn('key', [
                'facial_recognition_enabled',
                'face_match_threshold',
                'face_verification_timeout',
                'face_enrollment_required',
            ])
            ->delete();
    }
};
