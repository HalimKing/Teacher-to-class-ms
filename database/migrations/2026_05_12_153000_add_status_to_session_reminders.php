<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('session_reminders', function (Blueprint $table) {
            $table->string('status')->default('pending')->after('send_via');
            $table->string('error_message')->nullable()->after('status');
        });
    }

    public function down()
    {
        Schema::table('session_reminders', function (Blueprint $table) {
            $table->dropColumn(['error_message', 'status']);
        });
    }
};
