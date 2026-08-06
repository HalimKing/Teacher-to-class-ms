<?php

use App\Models\SystemSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => 'administrator_venue_change_requests_enabled'],
            [
                'value' => '1',
                'group' => 'attendance',
                'type' => 'boolean',
                'description' => 'When enabled, administrator staff can submit venue change requests for approval. When disabled, the request option is hidden and new submissions are blocked. Existing approved authorizations still work. Direct admin authorizations are unaffected.',
            ]
        );

        SystemSetting::clearCache();
    }

    public function down(): void
    {
        SystemSetting::query()->where('key', 'administrator_venue_change_requests_enabled')->delete();
        SystemSetting::clearCache();
    }
};
