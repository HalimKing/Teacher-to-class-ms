<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('staff_face_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->unique()->constrained('teachers')->cascadeOnDelete();
            $table->longText('embedding');
            $table->unsignedSmallInteger('embedding_dimension');
            $table->string('embedding_model', 64);
            $table->string('embedding_version', 64);
            $table->decimal('quality_score', 5, 4)->nullable();
            $table->decimal('liveness_score', 5, 4)->nullable();
            $table->timestamp('enrolled_at')->nullable();
            $table->timestamp('last_verified_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('migration_required')->default(false);
            $table->timestamps();

            $table->index(['is_active', 'migration_required']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_face_profiles');
    }
};
