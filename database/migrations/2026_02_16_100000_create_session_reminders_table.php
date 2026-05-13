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
        Schema::create('session_reminders', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('teacher_id');
            $table->foreign('teacher_id')->references('id')->on('teachers')->onDelete('cascade');
            $table->unsignedBigInteger('timetable_id')->nullable();
            $table->foreign('timetable_id')->references('id')->on('time_tables')->onDelete('cascade');
            $table->string('title');
            $table->text('message')->nullable();
            $table->dateTime('reminder_at');
            $table->dateTime('triggered_at')->nullable();
            $table->timestamps();

            $table->index(['teacher_id', 'reminder_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('session_reminders');
    }
};
