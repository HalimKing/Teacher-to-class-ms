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
        Schema::table('courses', function (Blueprint $table) {
            //
            $table->unsignedBigInteger('level_id')->nullable()->after('program_id');
            $table->unsignedBigInteger('academic_year_id')->nullable()->after('level_id');
            $table->unsignedBigInteger('academic_period_id')->nullable()->after('academic_year_id');
            $table->foreign('level_id')->references('id')->on('levels')->onDelete('cascade');
            $table->foreign('academic_year_id')->references('id')->on('academic_years')->onDelete('cascade');
            $table->foreign('academic_period_id')->references('id')->on('academic_periods')->onDelete('cascade');

            $table->integer('student_size')->default(0)->after('academic_period_id');

            $table->index(['level_id', 'academic_year_id', 'academic_period_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            //
            $table->dropForeign(['level_id']);
            $table->dropForeign(['academic_year_id']);
            $table->dropForeign(['academic_period_id']);
            $table->dropColumn('student_size');
        });
    }
};
