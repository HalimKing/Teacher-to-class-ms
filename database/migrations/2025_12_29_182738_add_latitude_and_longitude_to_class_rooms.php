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
        Schema::table('class_rooms', function (Blueprint $table) {
            //
            $table->decimal('latitude', 10, 8)->nullable()->after('capacity');
            $table->decimal('longitude', 11, 8)->nullable()->after('latitude');
            $table->decimal('radius_meters', 8, 2)->default(50)->after('longitude');
            $table->boolean('is_active')->default(true)->after('radius_meters');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('class_rooms', function (Blueprint $table) {
            //
            $table->dropColumn(['latitude', 'longitude', 'radius_meters', 'is_active']);
        });
    }
};
