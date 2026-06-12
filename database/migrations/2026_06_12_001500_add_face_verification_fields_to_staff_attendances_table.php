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
        Schema::table('staff_attendances', function (Blueprint $table) {
            if (!Schema::hasColumn('staff_attendances', 'face_verified')) {
                $table->boolean('face_verified')->default(false)->after('attendance_status');
            }

            if (!Schema::hasColumn('staff_attendances', 'face_match_score')) {
                $table->decimal('face_match_score', 8, 6)->nullable()->after('face_verified');
            }

            if (!Schema::hasColumn('staff_attendances', 'face_verified_at')) {
                $table->timestamp('face_verified_at')->nullable()->after('face_match_score');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('staff_attendances', function (Blueprint $table) {
            if (Schema::hasColumn('staff_attendances', 'face_verified_at')) {
                $table->dropColumn('face_verified_at');
            }

            if (Schema::hasColumn('staff_attendances', 'face_match_score')) {
                $table->dropColumn('face_match_score');
            }

            if (Schema::hasColumn('staff_attendances', 'face_verified')) {
                $table->dropColumn('face_verified');
            }
        });
    }
};
