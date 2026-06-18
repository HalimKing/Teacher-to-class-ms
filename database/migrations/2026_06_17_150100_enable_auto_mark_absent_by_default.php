<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('system_settings')
            ->where('key', 'auto_mark_absent_after_end')
            ->update(['value' => '1']);
    }

    public function down(): void
    {
        DB::table('system_settings')
            ->where('key', 'auto_mark_absent_after_end')
            ->update(['value' => '0']);
    }
};
