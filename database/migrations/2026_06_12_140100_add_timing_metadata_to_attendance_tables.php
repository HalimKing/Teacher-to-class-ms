<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('teacher_attendances', function (Blueprint $table) {
            $table->string('arrival_category')->nullable()->after('status');
            $table->unsignedSmallInteger('minutes_early')->nullable()->after('arrival_category');
            $table->unsignedSmallInteger('minutes_late')->nullable()->after('minutes_early');
            $table->string('departure_category')->nullable()->after('minutes_late');
            $table->unsignedSmallInteger('minutes_overtime')->nullable()->after('departure_category');
        });

        Schema::table('staff_attendances', function (Blueprint $table) {
            $table->string('departure_category')->nullable()->after('minutes_late');
            $table->unsignedSmallInteger('minutes_overtime')->nullable()->after('departure_category');
        });
    }

    public function down(): void
    {
        Schema::table('teacher_attendances', function (Blueprint $table) {
            $table->dropColumn([
                'arrival_category',
                'minutes_early',
                'minutes_late',
                'departure_category',
                'minutes_overtime',
            ]);
        });

        Schema::table('staff_attendances', function (Blueprint $table) {
            $table->dropColumn(['departure_category', 'minutes_overtime']);
        });
    }
};
