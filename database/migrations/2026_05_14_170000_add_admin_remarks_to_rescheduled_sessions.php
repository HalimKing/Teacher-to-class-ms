<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('rescheduled_sessions', function (Blueprint $table) {
            $table->text('admin_remarks')->nullable()->after('rejected_reason');
        });
    }

    public function down()
    {
        Schema::table('rescheduled_sessions', function (Blueprint $table) {
            $table->dropColumn('admin_remarks');
        });
    }
};
