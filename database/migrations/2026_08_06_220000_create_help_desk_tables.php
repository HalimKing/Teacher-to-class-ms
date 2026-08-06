<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('help_desk_tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_number', 32)->unique();
            $table->string('subject');
            $table->text('description');
            $table->string('category', 32);
            $table->string('priority', 16)->default('medium');
            $table->string('status', 32)->default('open');
            $table->foreignId('created_by')->constrained('teachers')->cascadeOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->string('attachment_path')->nullable();
            $table->string('attachment_name')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->index(['created_by', 'status'], 'hdt_creator_status_idx');
            $table->index('status', 'hdt_status_idx');
            $table->index('priority', 'hdt_priority_idx');
            $table->index('assigned_to', 'hdt_assigned_idx');
        });

        Schema::create('help_desk_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('help_desk_tickets')->cascadeOnDelete();
            $table->text('body');
            $table->string('author_type', 16);
            $table->unsignedBigInteger('author_id');
            $table->string('attachment_path')->nullable();
            $table->string('attachment_name')->nullable();
            $table->timestamps();

            $table->index(['author_type', 'author_id'], 'hdc_author_idx');
            $table->index('ticket_id', 'hdc_ticket_idx');
        });

        Schema::create('help_desk_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('help_desk_tickets')->cascadeOnDelete();
            $table->string('actor_type', 16)->nullable();
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('action', 64);
            $table->string('from_value')->nullable();
            $table->string('to_value')->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('ticket_id', 'hda_ticket_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('help_desk_activities');
        Schema::dropIfExists('help_desk_comments');
        Schema::dropIfExists('help_desk_tickets');
    }
};
