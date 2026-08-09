<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('holiday_breaks', function (Blueprint $table) {
            $table->string('coverage_type', 40)->default('all_staff')->after('status');
        });

        Schema::create('holiday_break_coverage_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('holiday_break_id')->constrained('holiday_breaks')->cascadeOnDelete();
            $table->foreignId('teacher_id')->constrained('teachers')->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['holiday_break_id', 'teacher_id'], 'hb_coverage_break_teacher_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('holiday_break_coverage_assignments');

        Schema::table('holiday_breaks', function (Blueprint $table) {
            $table->dropColumn('coverage_type');
        });
    }
};
