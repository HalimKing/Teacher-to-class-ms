<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('face_verification_attempts', function (Blueprint $table) {
            if (! Schema::hasColumn('face_verification_attempts', 'liveness_passed')) {
                $table->boolean('liveness_passed')->nullable()->after('failure_reason');
            }
            if (! Schema::hasColumn('face_verification_attempts', 'quality_score')) {
                $table->decimal('quality_score', 5, 4)->nullable()->after('liveness_passed');
            }
            if (! Schema::hasColumn('face_verification_attempts', 'processing_time_ms')) {
                $table->unsignedInteger('processing_time_ms')->nullable()->after('quality_score');
            }
            if (! Schema::hasColumn('face_verification_attempts', 'engine')) {
                $table->string('engine', 32)->nullable()->after('processing_time_ms');
            }
        });
    }

    public function down(): void
    {
        Schema::table('face_verification_attempts', function (Blueprint $table) {
            foreach (['engine', 'processing_time_ms', 'quality_score', 'liveness_passed'] as $column) {
                if (Schema::hasColumn('face_verification_attempts', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
