<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('teacher_attendances', function (Blueprint $table) {
            $table->foreignId('rescheduled_session_id')
                ->nullable()
                ->after('timetable_id')
                ->constrained('rescheduled_sessions')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('teacher_attendances', function (Blueprint $table) {
            $table->dropConstrainedForeignId('rescheduled_session_id');
        });
    }
};
