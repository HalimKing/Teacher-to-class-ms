<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Cleanup stray temp table from a prior failed SQLite migration attempt.
        Schema::dropIfExists('__temp__rescheduled_sessions');

        DB::statement(
            'UPDATE rescheduled_sessions SET classroom_id = (
                SELECT class_room_id FROM time_tables WHERE time_tables.id = rescheduled_sessions.timetable_id
            ) WHERE classroom_id IS NULL'
        );

        Schema::table('rescheduled_sessions', function (Blueprint $table) {
            $table->dropForeign(['classroom_id']);
        });

        Schema::table('rescheduled_sessions', function (Blueprint $table) {
            $table->unsignedBigInteger('classroom_id')->nullable(false)->change();
        });

        Schema::table('rescheduled_sessions', function (Blueprint $table) {
            $table->foreign('classroom_id')
                ->references('id')
                ->on('class_rooms')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('rescheduled_sessions', function (Blueprint $table) {
            $table->dropForeign(['classroom_id']);
        });

        Schema::table('rescheduled_sessions', function (Blueprint $table) {
            $table->unsignedBigInteger('classroom_id')->nullable()->change();
        });

        Schema::table('rescheduled_sessions', function (Blueprint $table) {
            $table->foreign('classroom_id')
                ->references('id')
                ->on('class_rooms')
                ->nullOnDelete();
        });
    }
};
