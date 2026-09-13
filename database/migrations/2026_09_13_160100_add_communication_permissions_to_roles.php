<?php

use App\Support\CommunicationPermissions;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permissionModels = collect(CommunicationPermissions::all())->map(
            fn (string $name) => Permission::firstOrCreate([
                'name' => $name,
                'guard_name' => 'web',
            ])
        );

        Role::query()->each(function (Role $role) use ($permissionModels) {
            $shouldAssign = $role->hasPermissionTo('admin.dashboard.view')
                || $role->hasPermissionTo('admin.help-desk.view')
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
            ->whereIn('name', CommunicationPermissions::all())
            ->where('guard_name', 'web')
            ->delete();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
