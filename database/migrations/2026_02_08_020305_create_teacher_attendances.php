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
        Schema::create('teacher_attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')
            ->constrained('teachers')
            ->cascadeOnDelete();

            $table->foreignId('course_id')
                ->constrained('courses')
                ->cascadeOnDelete();

            $table->foreignId('classroom_id')
                ->constrained('class_rooms')
                ->cascadeOnDelete();

            $table->foreignId('timetable_id')
                ->constrained('time_tables')
                ->cascadeOnDelete();
            
            $table->foreignId('academic_year_id')
            ->constrained('academic_years')
            ->cascadeOnDelete();

            // Attendance date
            $table->date('date');

            // CHECK-IN (Start of lecture)
            $table->time('check_in_time')->nullable();
            $table->decimal('check_in_latitude', 10, 7)->nullable();
            $table->decimal('check_in_longitude', 10, 7)->nullable();
            $table->string('check_in_address')->nullable();
            $table->string('check_in_distance')->nullable();
            // check in within range or not
            $table->boolean('check_in_within_range')->default(false);


            // CHECK-OUT (End of lecture)
            $table->time('check_out_time')->nullable();
            $table->decimal('check_out_latitude', 10, 7)->nullable();
            $table->decimal('check_out_longitude', 10, 7)->nullable();
            $table->string('check_out_address')->nullable();
            $table->string('check_out_distance')->nullable();
                // check out within range or not
            $table->boolean('check_out_within_range')->default(false);  
            

            // Status
            $table->enum('status', ['pending', 'completed', 'absent', 'late', 'early_leave'])
            ->default('pending');

            $table->timestamps();

            $table->unique(['teacher_id', 'course_id', 'classroom_id', 'timetable_id', 'date'], 'unique_attendance');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('teacher_attendances');
    }
};
