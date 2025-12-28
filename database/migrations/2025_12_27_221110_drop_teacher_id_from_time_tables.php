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
        Schema::table('time_tables', function (Blueprint $table) {
            //
            $table->unsignedBigInteger('teacher_id')->nullable()->after('class_room_id');
            $table->foreign('teacher_id')->references('id')->on('teachers')->onDelete('set null');

        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('time_tables', function (Blueprint $table) {
            //
            $table->dropForeign(['teacher_id']);
            $table->dropColumn('teacher_id');
        });
    }
};
