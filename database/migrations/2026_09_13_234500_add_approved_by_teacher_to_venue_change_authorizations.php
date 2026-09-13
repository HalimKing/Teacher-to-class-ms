<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('venue_change_authorizations', function (Blueprint $table) {
            $table->dropForeign(['approved_by']);
        });

        Schema::table('venue_change_authorizations', function (Blueprint $table) {
            $table->unsignedBigInteger('approved_by')->nullable()->change();
            $table->foreign('approved_by')->references('id')->on('users')->nullOnDelete();
            $table->foreignId('approved_by_teacher_id')
                ->nullable()
                ->after('approved_by')
                ->constrained('teachers')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('venue_change_authorizations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('approved_by_teacher_id');
            $table->dropForeign(['approved_by']);
        });

        Schema::table('venue_change_authorizations', function (Blueprint $table) {
            $table->unsignedBigInteger('approved_by')->nullable(false)->change();
            $table->foreign('approved_by')->references('id')->on('users')->cascadeOnDelete();
        });
    }
};
