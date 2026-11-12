<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_reminders', function (Blueprint $table) {
            $table->string('send_via', 10)->default('both')->after('message');
        });
    }

    public function down(): void
    {
        Schema::table('attendance_reminders', function (Blueprint $table) {
            $table->dropColumn('send_via');
        });
    }
};
