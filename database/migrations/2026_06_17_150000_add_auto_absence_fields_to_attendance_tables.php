<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
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
    }

    public function down(): void
    {
        Schema::table('staff_attendances', function (Blueprint $table) {
            $table->dropColumn(['attendance_source', 'auto_generated', 'auto_generated_at', 'auto_absence_reason']);
        });

        Schema::table('teacher_attendances', function (Blueprint $table) {
            $table->dropColumn(['attendance_source', 'auto_generated', 'auto_generated_at', 'auto_absence_reason']);
        });
    }
};
