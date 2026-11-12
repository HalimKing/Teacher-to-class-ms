<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_reminders', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
        });

        Schema::table('attendance_reminders', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->nullable()->change();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreignId('teacher_id')->nullable()->after('user_id')->constrained('teachers')->cascadeOnDelete();
            $table->index(['teacher_id', 'is_active']);
        });

        DB::table('attendance_reminders')->whereNull('teacher_id')->update(['is_active' => false]);

        if (Schema::hasTable('permissions')) {
            $names = [
                'admin.reminders.view',
                'admin.reminders.create',
                'admin.reminders.edit',
                'admin.reminders.delete',
                'admin.reminders.manage-all',
                'admin.reminders.recipients.all',
                'admin.reminders.recipients.units',
                'admin.reminders.recipients.staff',
            ];
            $ids = DB::table('permissions')->whereIn('name', $names)->pluck('id');

            if ($ids->isNotEmpty()) {
                foreach (['role_has_permissions', 'model_has_permissions'] as $table) {
                    if (Schema::hasTable($table)) {
                        DB::table($table)->whereIn('permission_id', $ids)->delete();
                    }
                }

                DB::table('permissions')->whereIn('id', $ids)->delete();
            }
        }

        if (Schema::hasTable('system_settings')) {
            DB::table('system_settings')
                ->where('key', 'max_reminders_per_administrator')
                ->update([
                    'description' => 'Maximum number of attendance reminders each administrator staff member can create for themselves. Reminders stay active until that staff member disables or deletes them.',
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('attendance_reminders', function (Blueprint $table) {
            $table->dropForeign(['teacher_id']);
            $table->dropIndex(['teacher_id', 'is_active']);
            $table->dropColumn('teacher_id');
            $table->dropForeign(['user_id']);
        });

        DB::table('attendance_reminders')->whereNull('user_id')->delete();

        Schema::table('attendance_reminders', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->nullable(false)->change();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }
};
