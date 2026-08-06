<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_explanations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->constrained('teachers')->cascadeOnDelete();
            $table->string('attendance_type'); // staff | teacher
            $table->unsignedBigInteger('attendance_id');
            $table->foreignId('timetable_id')->nullable()->constrained('time_tables')->nullOnDelete();
            $table->date('attendance_date');
            $table->enum('explanation_type', ['absence', 'early_departure']);
            $table->string('reason_category');
            $table->text('explanation');
            $table->string('supporting_document_path')->nullable();
            $table->string('supporting_document_name')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('admin_comments')->nullable();
            $table->string('status_applied')->nullable(); // e.g. excused_absence
            $table->timestamps();

            $table->index(['attendance_type', 'attendance_id'], 'ae_attendance_idx');
            $table->index(['staff_id', 'status'], 'ae_staff_status_idx');
            $table->index(['explanation_type', 'status'], 'ae_type_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_explanations');
    }
};
