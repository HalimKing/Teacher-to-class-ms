<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // Drop any stray temp table from a prior failed attempt (SQLite change() implementation)
        \DB::statement('DROP TABLE IF EXISTS "__temp__rescheduled_sessions"');

        // Backfill existing null classroom_id values from the linked timetable's class_room_id
        \DB::statement('UPDATE rescheduled_sessions SET classroom_id = (SELECT class_room_id FROM time_tables WHERE time_tables.id = rescheduled_sessions.timetable_id) WHERE classroom_id IS NULL');

        // NOTE: Changing column nullability requires the doctrine/dbal package for some databases.
        // If you see an error, run: composer require doctrine/dbal
        Schema::table('rescheduled_sessions', function (Blueprint $table) {
            $table->unsignedBigInteger('classroom_id')->nullable(false)->change();
        });
    }

    public function down()
    {
        Schema::table('rescheduled_sessions', function (Blueprint $table) {
            $table->unsignedBigInteger('classroom_id')->nullable()->change();
        });
    }
};
