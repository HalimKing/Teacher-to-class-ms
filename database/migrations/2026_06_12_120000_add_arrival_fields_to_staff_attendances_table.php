<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('staff_attendances', function (Blueprint $table) {
            $table->string('arrival_category')->nullable()->after('attendance_status');
            $table->unsignedSmallInteger('minutes_early')->nullable()->after('arrival_category');
            $table->unsignedSmallInteger('minutes_late')->nullable()->after('minutes_early');
        });
    }

    public function down(): void
    {
        Schema::table('staff_attendances', function (Blueprint $table) {
            $table->dropColumn(['arrival_category', 'minutes_early', 'minutes_late']);
        });
    }
};
