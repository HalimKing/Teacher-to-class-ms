<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('staff_attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->constrained('teachers')->cascadeOnDelete();
            $table->foreignId('timetable_id')->constrained('time_tables')->cascadeOnDelete();
            $table->foreignId('classroom_id')->constrained('class_rooms')->cascadeOnDelete();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->date('date');
            $table->time('check_in_time')->nullable();
            $table->time('check_out_time')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->decimal('check_out_latitude', 10, 7)->nullable();
            $table->decimal('check_out_longitude', 10, 7)->nullable();
            $table->string('check_in_distance')->nullable();
            $table->string('check_out_distance')->nullable();
            $table->boolean('check_in_within_range')->default(false);
            $table->boolean('check_out_within_range')->default(false);
            $table->enum('attendance_status', ['pending', 'checked_in', 'completed', 'late', 'early_leave'])->default('pending');
            $table->timestamps();

            $table->unique(['staff_id', 'timetable_id', 'date'], 'unique_staff_attendance');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('staff_attendances');
    }
};
