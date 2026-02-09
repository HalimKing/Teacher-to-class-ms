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
        Schema::table('teacher_attendances', function (Blueprint $table) {
            //
            $table->enum('status', ['pending','present', 'absent', 'completed'])->default('pending')->after('check_out_within_range');
            $table->enum('check_in_status', ['late', 'present', 'absent'])->default('late')->after('status');
            $table->enum('check_out_status', ['early_leave', 'present', 'absent'])->default('present')->after('check_in_status');

        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('teacher_attendances', function (Blueprint $table) {
            //
            $table->dropColumn('status');
            $table->dropColumn('check_in_status');
            $table->dropColumn('check_out_status');
        });
    }
};
