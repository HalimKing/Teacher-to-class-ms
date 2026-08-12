<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Status is stored as a string so additional values (late, early_leave, overtime)
        // do not require dialect-specific ENUM alterations.
        Schema::table('teacher_attendances', function (Blueprint $table) {
            $table->string('status', 32)->default('pending')->change();
        });
    }

    public function down(): void
    {
        Schema::table('teacher_attendances', function (Blueprint $table) {
            $table->string('status', 32)->default('pending')->change();
        });
    }
};
