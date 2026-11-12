<?php

use App\Models\SystemSetting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    /**
     * @var list<string>
     */
    private const PERMISSIONS = [
        'admin.reminders.view',
        'admin.reminders.create',
        'admin.reminders.edit',
        'admin.reminders.delete',
        'admin.reminders.manage-all',
        'admin.reminders.recipients.all',
        'admin.reminders.recipients.units',
        'admin.reminders.recipients.staff',
    ];

    public function up(): void
    {
        Schema::create('attendance_reminders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('type', 20);
            $table->json('days');
            $table->string('trigger', 32);
            $table->unsignedSmallInteger('offset_minutes');
            $table->string('recipient_scope', 20);
            $table->text('message')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['user_id', 'is_active']);
            $table->index('is_active');
        });

        Schema::create('attendance_reminder_targets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attendance_reminder_id')->constrained()->cascadeOnDelete();
            $table->string('target_type', 20);
            $table->unsignedBigInteger('target_id');
            $table->timestamps();

            $table->unique(['attendance_reminder_id', 'target_type', 'target_id'], 'attendance_reminder_targets_unique');
            $table->index(['target_type', 'target_id']);
        });

        Schema::create('attendance_reminder_dispatches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attendance_reminder_id')->constrained()->cascadeOnDelete();
            $table->foreignId('teacher_id')->constrained('teachers')->cascadeOnDelete();
            $table->foreignId('timetable_id')->constrained('time_tables')->cascadeOnDelete();
            $table->date('session_date');
            $table->foreignId('rescheduled_session_id')->nullable()->constrained('rescheduled_sessions')->nullOnDelete();
            $table->dateTime('scheduled_for');
            $table->dateTime('notified_at')->nullable();
            $table->string('channel', 40)->nullable();
            $table->string('status', 20)->default('pending');
            $table->text('failure_reason')->nullable();
            $table->timestamps();

            $table->unique(
                ['attendance_reminder_id', 'teacher_id', 'timetable_id', 'session_date'],
                'attendance_reminder_dispatches_once'
            );
            $table->index(['status', 'scheduled_for']);
        });

        if (! Schema::hasTable('permissions')) {
            return;
        }

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permissionModels = collect(self::PERMISSIONS)->map(
            fn (string $name) => Permission::findOrCreate($name, 'web')
        );

        $allows = function (Role $role, string $permission): bool {
            try {
                return $role->hasPermissionTo($permission);
            } catch (\Throwable) {
                return false;
            }
        };

        Role::query()->each(function (Role $role) use ($permissionModels, $allows) {
            $canUseReminders = $allows($role, 'admin.teachers.view')
                || $allows($role, 'admin.settings.view')
                || $allows($role, 'admin.dashboard.view');

            if (! $canUseReminders) {
                return;
            }

            $grant = $permissionModels->reject(
                fn (Permission $permission) => $permission->name === 'admin.reminders.manage-all'
                    && ! $allows($role, 'admin.settings.edit')
            );

            $role->givePermissionTo($grant);
        });

        SystemSetting::query()->firstOrCreate(
            ['key' => 'max_reminders_per_administrator'],
            [
                'value' => '5',
                'group' => 'attendance',
                'type' => 'integer',
                'description' => 'Maximum number of attendance reminder configurations each administrator can create. Reminders stay active until an administrator disables or deletes them.',
            ]
        );
        SystemSetting::clearCache();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_reminder_dispatches');
        Schema::dropIfExists('attendance_reminder_targets');
        Schema::dropIfExists('attendance_reminders');

        if (Schema::hasTable('permissions')) {
            app()[PermissionRegistrar::class]->forgetCachedPermissions();
            Permission::query()->whereIn('name', self::PERMISSIONS)->where('guard_name', 'web')->delete();
            app()[PermissionRegistrar::class]->forgetCachedPermissions();
        }

        SystemSetting::query()->where('key', 'max_reminders_per_administrator')->delete();
        SystemSetting::clearCache();
    }
};
