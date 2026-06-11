<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $fallbackClassRoomId = DB::table('class_rooms')->value('id');

        if ($fallbackClassRoomId) {
            DB::table('time_tables')
                ->whereNull('class_room_id')
                ->update(['class_room_id' => $fallbackClassRoomId]);
        }

        Schema::table('time_tables', function (Blueprint $table) {
            $table->unsignedBigInteger('class_room_id')->nullable(false)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('time_tables', function (Blueprint $table) {
            $table->unsignedBigInteger('class_room_id')->nullable()->change();
        });
    }
};
