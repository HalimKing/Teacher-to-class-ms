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

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement(
                'UPDATE rescheduled_sessions rs
                INNER JOIN time_tables tt ON tt.id = rs.timetable_id
                SET rs.classroom_id = tt.class_room_id
                WHERE rs.classroom_id IS NULL'
            );
        } else {
            DB::statement(
                'UPDATE rescheduled_sessions SET classroom_id = (
                    SELECT class_room_id FROM time_tables WHERE time_tables.id = rescheduled_sessions.timetable_id
                ) WHERE classroom_id IS NULL'
            );
        }

        Schema::table('rescheduled_sessions', function (Blueprint $table) {
            $table->dropForeign(['classroom_id']);
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement(
                'ALTER TABLE rescheduled_sessions MODIFY classroom_id BIGINT UNSIGNED NOT NULL'
            );
        } else {
            Schema::table('rescheduled_sessions', function (Blueprint $table) {
                $table->unsignedBigInteger('classroom_id')->nullable(false)->change();
            });
        }

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

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement(
                'ALTER TABLE rescheduled_sessions MODIFY classroom_id BIGINT UNSIGNED NULL'
            );
        } else {
            Schema::table('rescheduled_sessions', function (Blueprint $table) {
                $table->unsignedBigInteger('classroom_id')->nullable()->change();
            });
        }

        Schema::table('rescheduled_sessions', function (Blueprint $table) {
            $table->foreign('classroom_id')
                ->references('id')
                ->on('class_rooms')
                ->nullOnDelete();
        });
    }
};
