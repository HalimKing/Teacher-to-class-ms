<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('holiday_breaks', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('type', 40);
            $table->date('start_date');
            $table->date('end_date');
            $table->text('description')->nullable();
            $table->string('status', 20)->default('active');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['status', 'start_date', 'end_date']);
        });

        Schema::create('holiday_break_duty_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('holiday_break_id')->constrained('holiday_breaks')->cascadeOnDelete();
            $table->foreignId('teacher_id')->constrained('teachers')->cascadeOnDelete();
            $table->json('duty_dates')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['holiday_break_id', 'teacher_id'], 'hb_duty_break_teacher_unique');
        });

        Schema::table('teacher_attendances', function (Blueprint $table) {
            $table->foreignId('holiday_break_id')
                ->nullable()
                ->after('exception_category')
                ->constrained('holiday_breaks')
                ->nullOnDelete();
        });

        Schema::table('staff_attendances', function (Blueprint $table) {
            $table->foreignId('holiday_break_id')
                ->nullable()
                ->after('exception_category')
                ->constrained('holiday_breaks')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('staff_attendances', function (Blueprint $table) {
            $table->dropConstrainedForeignId('holiday_break_id');
        });

        Schema::table('teacher_attendances', function (Blueprint $table) {
            $table->dropConstrainedForeignId('holiday_break_id');
        });

        Schema::dropIfExists('holiday_break_duty_assignments');
        Schema::dropIfExists('holiday_breaks');
    }
};
