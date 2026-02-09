<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;

class PermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        //
        // Create permissions here
        $permissions = [
            'admin.dashboard.view',
            'admin.user-management.users.view',
            'admin.user-management.users.create',
            'admin.user-management.users.edit',
            'admin.user-management.users.delete',
            'admin.academics.time-tables.view',
            'admin.academics.time-tables.create',
            'admin.academics.time-tables.edit',
            'admin.academics.time-tables.delete',
            'admin.school-management.class-rooms.view',
            'admin.school-management.class-rooms.create',
            'admin.school-management.class-rooms.edit',
            'admin.school-management.class-rooms.delete',
            'admin.school-management.faculties.view',
            'admin.school-management.faculties.create',
            'admin.school-management.faculties.edit',
            'admin.school-management.faculties.delete',
            'admin.school-management.departments.view',
            'admin.school-management.departments.create',
            'admin.school-management.departments.edit',
            'admin.school-management.departments.delete',
            'admin.school-management.academic-years.view',
            'admin.school-management.academic-years.create',
            'admin.school-management.academic-years.edit',
            'admin.school-management.academic-years.toggle-status',
            'admin.school-management.academic-years.delete',
            'admin.school-management.academic-periods.view',
            'admin.school-management.academic-periods.create',
            'admin.school-management.academic-periods.edit',
            'admin.school-management.academic-periods.delete',
            'admin.school-management.programs.view',
            'admin.school-management.programs.create',
            'admin.school-management.programs.edit',
            'admin.school-management.programs.delete',
            'admin.school-management.courses.view',
            'admin.school-management.courses.create',
            'admin.school-management.courses.edit', 
            'admin.school-management.courses.delete',
            'admin.user-management.roles.view',
            'admin.user-management.roles.create',
            'admin.user-management.roles.edit',
            'admin.user-management.roles.delete',
            'admin.teachers.view',
            'admin.teachers.create',
            'admin.teachers.edit',
            'admin.teachers.delete',
            'admin.teachers.password-management',
        ];
        foreach ($permissions as $permission) {
            Permission::create(['name' => $permission]);
        }
    }
}
