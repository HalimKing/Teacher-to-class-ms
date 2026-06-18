<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::statement(
            "ALTER TABLE teacher_attendances MODIFY status ENUM(
                'pending',
                'present',
                'absent',
                'completed',
                'incomplete',
                'late',
                'early_leave',
                'overtime'
            ) NOT NULL DEFAULT 'pending'"
        );
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::statement(
            "UPDATE teacher_attendances SET status = 'completed' WHERE status IN ('late', 'early_leave', 'overtime')"
        );

        DB::statement(
            "ALTER TABLE teacher_attendances MODIFY status ENUM(
                'pending',
                'present',
                'absent',
                'completed',
                'incomplete'
            ) NOT NULL DEFAULT 'pending'"
        );
    }
};
