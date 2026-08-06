<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('venue_change_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->constrained('teachers')->cascadeOnDelete();
            $table->foreignId('authorized_classroom_id')->constrained('class_rooms')->cascadeOnDelete();
            $table->enum('authorization_type', ['check_in', 'check_out', 'both'])->default('both');
            $table->date('start_date');
            $table->date('end_date');
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->string('reason');
            $table->text('notes')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('admin_comments')->nullable();
            $table->uuid('resulting_bulk_group_id')->nullable();
            $table->foreignId('resulting_authorization_id')
                ->nullable()
                ->constrained('venue_change_authorizations')
                ->nullOnDelete();
            $table->timestamps();

            $table->index(['staff_id', 'status'], 'vcr_staff_status_idx');
            $table->index(['start_date', 'end_date', 'status'], 'vcr_period_status_idx');
        });

        Schema::create('venue_change_request_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('venue_change_request_id')
                ->constrained('venue_change_requests')
                ->cascadeOnDelete();
            $table->foreignId('timetable_id')->constrained('time_tables')->cascadeOnDelete();
            $table->foreignId('original_classroom_id')->constrained('class_rooms')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['venue_change_request_id', 'timetable_id'], 'vcr_item_unique');
        });

        Schema::table('venue_change_authorizations', function (Blueprint $table) {
            $table->foreignId('source_request_id')
                ->nullable()
                ->after('bulk_group_id')
                ->constrained('venue_change_requests')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('venue_change_authorizations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('source_request_id');
        });

        Schema::dropIfExists('venue_change_request_items');
        Schema::dropIfExists('venue_change_requests');
    }
};
