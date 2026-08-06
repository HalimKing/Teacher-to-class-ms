<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE staff_attendances MODIFY attendance_status ENUM(
                'checked_in','late','early_leave','completed','overtime','incomplete','absent','excused_absence'
            ) NOT NULL DEFAULT 'checked_in'");
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE staff_attendances MODIFY attendance_status ENUM(
                'checked_in','late','early_leave','completed','overtime','incomplete','absent'
            ) NOT NULL DEFAULT 'checked_in'");
        }
    }
};
