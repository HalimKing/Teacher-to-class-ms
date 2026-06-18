<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('status', 20)->default('active')->after('staff_id');
            $table->boolean('must_change_password')->default(false)->after('password');
            $table->timestamp('password_changed_at')->nullable()->after('must_change_password');
            $table->timestamp('last_login_at')->nullable()->after('password_changed_at');
            $table->timestamp('locked_at')->nullable()->after('last_login_at');

            $table->index(['status', 'created_at']);
            $table->index('last_login_at');
            $table->index('must_change_password');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['status', 'created_at']);
            $table->dropIndex(['last_login_at']);
            $table->dropIndex(['must_change_password']);
            $table->dropColumn(['status', 'must_change_password', 'password_changed_at', 'last_login_at', 'locked_at']);
        });
    }
};
