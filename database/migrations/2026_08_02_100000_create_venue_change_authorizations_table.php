<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('venue_change_authorizations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->constrained('teachers')->cascadeOnDelete();
            $table->foreignId('timetable_id')->nullable()->constrained('time_tables')->nullOnDelete();
            $table->foreignId('original_classroom_id')->constrained('class_rooms')->cascadeOnDelete();
            $table->foreignId('authorized_classroom_id')->constrained('class_rooms')->cascadeOnDelete();
            $table->enum('authorization_type', ['check_in', 'check_out', 'both'])->default('both');
            $table->date('authorization_date');
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->string('reason');
            $table->text('notes')->nullable();
            $table->enum('status', ['active', 'expired', 'revoked'])->default('active');
            $table->foreignId('approved_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('approved_at');
            $table->foreignId('revoked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('revoked_at')->nullable();
            $table->string('revoke_reason')->nullable();
            $table->timestamps();

            $table->index(['staff_id', 'authorization_date', 'status'], 'vca_staff_date_status_idx');
            $table->index(['timetable_id', 'authorization_date'], 'vca_timetable_date_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('venue_change_authorizations');
    }
};
