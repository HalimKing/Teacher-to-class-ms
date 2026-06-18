<?php

use App\Models\SystemSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => 'forgot_password_enabled'],
            [
                'value' => '1',
                'group' => 'security',
                'type' => 'boolean',
                'description' => 'Allow admin users and lecturers to request a password reset link from the login page.',
            ]
        );

        SystemSetting::clearCache();
    }

    public function down(): void
    {
        SystemSetting::query()->where('key', 'forgot_password_enabled')->delete();
        SystemSetting::clearCache();
    }
};
