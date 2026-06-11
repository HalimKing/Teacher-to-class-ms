<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('rescheduled_sessions', function (Blueprint $table) {
            $table->unsignedBigInteger('classroom_id')->nullable()->after('timetable_id');
            $table->foreign('classroom_id')->references('id')->on('class_rooms')->onDelete('set null');
        });
    }

    public function down()
    {
        Schema::table('rescheduled_sessions', function (Blueprint $table) {
            $table->dropForeign(['classroom_id']);
            $table->dropColumn('classroom_id');
        });
    }
};
