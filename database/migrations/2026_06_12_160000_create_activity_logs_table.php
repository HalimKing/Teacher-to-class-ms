<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->string('event_type', 100);
            $table->string('event_category', 50);
            $table->text('description');
            $table->string('status', 20)->default('success');
            $table->string('actor_type')->nullable();
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('actor_name')->default('System');
            $table->string('actor_role', 50)->default('system');
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->string('route')->nullable();
            $table->string('method', 10)->nullable();
            $table->json('metadata')->nullable();
            $table->boolean('is_security_flag')->default(false);
            $table->timestamp('created_at')->useCurrent();

            $table->index('created_at');
            $table->index('event_category');
            $table->index('event_type');
            $table->index('status');
            $table->index(['actor_type', 'actor_id']);
            $table->index('ip_address');
            $table->index('is_security_flag');
            $table->index(['event_category', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
