<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teacher_notification_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('teachers')->cascadeOnDelete();
            $table->boolean('attendance_enabled')->default(true);
            $table->boolean('timetable_enabled')->default(true);
            $table->boolean('administrative_enabled')->default(true);
            $table->boolean('system_enabled')->default(true);
            $table->boolean('email_enabled')->default(true);
            $table->timestamps();

            $table->unique('teacher_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teacher_notification_preferences');
    }
};
