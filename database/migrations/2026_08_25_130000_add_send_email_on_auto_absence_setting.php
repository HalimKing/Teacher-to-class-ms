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

        DB::table('system_settings')->updateOrInsert(
            ['key' => 'send_email_on_auto_absence'],
            [
                'value' => '1',
                'group' => 'attendance',
                'type' => 'boolean',
                'description' => 'When enabled, lecturers and administrators automatically receive an email after they are marked absent. When disabled, absence records and in-app alerts are unchanged, but no absence emails are sent.',
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        if (class_exists(\App\Models\SystemSetting::class)) {
            \App\Models\SystemSetting::clearCache();
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('system_settings')
            ->where('key', 'send_email_on_auto_absence')
            ->delete();

        if (class_exists(\App\Models\SystemSetting::class)) {
            \App\Models\SystemSetting::clearCache();
        }
    }
};
