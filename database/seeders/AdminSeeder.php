<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Seeds permissions, a Super Admin role, and the initial admin user.
 *
 * Run: php artisan db:seed --class=AdminSeeder
 *
 * Optional .env overrides:
 * - SEED_ADMIN_NAME
 * - SEED_ADMIN_EMAIL
 * - SEED_ADMIN_PASSWORD
 * - SEED_ADMIN_STAFF_ID
 */
class AdminSeeder extends Seeder
{
    public const SUPER_ADMIN_ROLE = 'Super Admin';

    public function run(): void
    {
        $this->call(PermissionSeeder::class);

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $role = Role::firstOrCreate([
            'name' => self::SUPER_ADMIN_ROLE,
            'guard_name' => 'web',
        ]);

        $permissions = Permission::query()
            ->where('guard_name', 'web')
            ->pluck('name');

        $role->syncPermissions($permissions);

        $email = (string) env('SEED_ADMIN_EMAIL', 'admin@example.com');
        $password = (string) env('SEED_ADMIN_PASSWORD', 'password');
        $name = (string) env('SEED_ADMIN_NAME', 'System Administrator');
        $staffId = (string) env('SEED_ADMIN_STAFF_ID', 'ADMIN001');

        $user = User::query()->updateOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'staff_id' => $staffId,
                'password' => Hash::make($password),
                'status' => User::STATUS_ACTIVE,
                'must_change_password' => false,
                'password_changed_at' => now(),
                'email_verified_at' => now(),
            ],
        );

        $user->syncRoles([$role]);

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $this->command?->info('Admin user ready.');
        $this->command?->line("  Email:    {$email}");
        $this->command?->line("  Password: {$password}");
        $this->command?->line('  Role:     ' . self::SUPER_ADMIN_ROLE);
        $this->command?->warn('Change the default password after first login.');
    }
}
