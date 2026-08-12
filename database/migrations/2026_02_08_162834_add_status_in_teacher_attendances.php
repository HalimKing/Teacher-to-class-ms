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
            $table->string('check_in_status', 32)->default('late')->after('check_out_within_range');
            $table->string('check_out_status', 32)->default('present')->after('check_in_status');

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
