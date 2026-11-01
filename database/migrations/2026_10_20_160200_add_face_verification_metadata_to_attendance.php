<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['teacher_attendances', 'staff_attendances'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                if (! Schema::hasColumn($tableName, 'face_liveness_passed')) {
                    $table->boolean('face_liveness_passed')->nullable();
                }
                if (! Schema::hasColumn($tableName, 'face_quality_score')) {
                    $table->decimal('face_quality_score', 5, 4)->nullable();
                }
                if (! Schema::hasColumn($tableName, 'face_model')) {
                    $table->string('face_model', 64)->nullable();
                }
                if (! Schema::hasColumn($tableName, 'face_verification_processing_ms')) {
                    $table->unsignedInteger('face_verification_processing_ms')->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        foreach (['teacher_attendances', 'staff_attendances'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                foreach ([
                    'face_verification_processing_ms',
                    'face_model',
                    'face_quality_score',
                    'face_liveness_passed',
                ] as $column) {
                    if (Schema::hasColumn($tableName, $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }
};
