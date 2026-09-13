<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('self_reported_absence_replies', function (Blueprint $table) {
            $table->id();
            $table->string('attendance_kind', 32);
            $table->unsignedBigInteger('attendance_id');
            $table->foreignId('author_id')->constrained('teachers')->cascadeOnDelete();
            $table->text('body');
            $table->timestamps();

            $table->index(['attendance_kind', 'attendance_id'], 'self_reported_absence_replies_record_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('self_reported_absence_replies');
    }
};
