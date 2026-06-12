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
        Schema::table('teachers', function (Blueprint $table) {
            if (!Schema::hasColumn('teachers', 'face_descriptor')) {
                $table->text('face_descriptor')->nullable()->after('staff_type');
            }

            if (!Schema::hasColumn('teachers', 'face_registered_at')) {
                $table->timestamp('face_registered_at')->nullable()->after('face_descriptor');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('teachers', function (Blueprint $table) {
            if (Schema::hasColumn('teachers', 'face_registered_at')) {
                $table->dropColumn('face_registered_at');
            }

            if (Schema::hasColumn('teachers', 'face_descriptor')) {
                $table->dropColumn('face_descriptor');
            }
        });
    }
};
