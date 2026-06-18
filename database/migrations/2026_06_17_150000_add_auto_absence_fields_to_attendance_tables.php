<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('teacher_attendances', function (Blueprint $table) {
            $table->string('attendance_source', 32)->default('manual')->after('status');
            $table->boolean('auto_generated')->default(false)->after('attendance_source');
            $table->timestamp('auto_generated_at')->nullable()->after('auto_generated');
            $table->string('auto_absence_reason')->nullable()->after('auto_generated_at');
        });

        Schema::table('staff_attendances', function (Blueprint $table) {
            $table->string('attendance_source', 32)->default('manual')->after('attendance_status');
            $table->boolean('auto_generated')->default(false)->after('attendance_source');
            $table->timestamp('auto_generated_at')->nullable()->after('auto_generated');
            $table->string('auto_absence_reason')->nullable()->after('auto_generated_at');
        });

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE staff_attendances MODIFY attendance_status ENUM('pending', 'checked_in', 'completed', 'late', 'early_leave', 'overtime', 'incomplete', 'absent') NOT NULL DEFAULT 'pending'");
        } elseif ($driver === 'sqlite') {
            Schema::table('staff_attendances', function (Blueprint $table) {
                $table->dropColumn('attendance_status');
            });

            Schema::table('staff_attendances', function (Blueprint $table) {
                $table->string('attendance_status', 32)->default('pending');
            });
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE staff_attendances MODIFY attendance_status ENUM('pending', 'checked_in', 'completed', 'late', 'early_leave') NOT NULL DEFAULT 'pending'");
        }

        Schema::table('staff_attendances', function (Blueprint $table) {
            $table->dropColumn(['attendance_source', 'auto_generated', 'auto_generated_at', 'auto_absence_reason']);
        });

        Schema::table('teacher_attendances', function (Blueprint $table) {
            $table->dropColumn(['attendance_source', 'auto_generated', 'auto_generated_at', 'auto_absence_reason']);
        });
    }
};
