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
        Schema::table('session_reminders', function (Blueprint $table) {
            $table->string('send_via')->default('mail')->after('message'); // mail | sms | both
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('session_reminders', function (Blueprint $table) {
            $table->dropColumn('send_via');
        });
    }
};
