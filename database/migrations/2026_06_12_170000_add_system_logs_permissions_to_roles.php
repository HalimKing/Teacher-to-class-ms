<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    private const PERMISSIONS = [
        'admin.system-logs.view',
        'admin.system-logs.export',
        'admin.system-logs.manage',
    ];

    public function up(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permissionModels = collect(self::PERMISSIONS)->map(
            fn (string $name) => Permission::firstOrCreate([
                'name' => $name,
                'guard_name' => 'web',
            ])
        );

        Role::query()->each(function (Role $role) use ($permissionModels) {
            $shouldAssign = $role->hasPermissionTo('admin.dashboard.view')
                || $role->hasPermissionTo('admin.settings.view')
                || $role->hasPermissionTo('admin.settings.edit')
                || $role->hasPermissionTo('admin.user-management.roles.edit');

            if ($shouldAssign) {
                $role->givePermissionTo($permissionModels);
            }
        });

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        Permission::query()
            ->whereIn('name', self::PERMISSIONS)
            ->where('guard_name', 'web')
            ->delete();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
