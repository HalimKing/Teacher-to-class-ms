<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Logs for attendance check-in/check-out attempts (success and failure).
 * Used when system settings enable attendance_logs_enabled / log_gps_attempts / log_failed_attempts.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->nullable()->constrained('teachers')->nullOnDelete();
            $table->string('action', 32)->index(); // check_in, check_out, attempt_failed
            $table->foreignId('timetable_id')->nullable()->constrained('time_tables')->nullOnDelete();
            $table->json('payload')->nullable(); // coords, distance, within_range, reason, etc.
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_activity_logs');
    }
};
