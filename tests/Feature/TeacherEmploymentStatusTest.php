<?php

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Teacher;
use App\Models\User;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Permission::firstOrCreate(['name' => 'admin.teachers.create', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.teachers.edit', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.teachers.view', 'guard_name' => 'web']);

    $role = Role::firstOrCreate(['name' => 'Super Admin', 'guard_name' => 'web']);
    $role->givePermissionTo(['admin.teachers.create', 'admin.teachers.edit', 'admin.teachers.view']);

    $this->admin = User::factory()->create();
    $this->admin->assignRole($role);

    $this->faculty = Faculty::create(['name' => 'Employment Faculty']);
    $this->department = Department::create([
        'name' => 'Employment Dept',
        'faculty_id' => $this->faculty->id,
    ]);
});

it('stores employment status when creating a staff member', function () {
    $response = $this->actingAs($this->admin)->post(route('admin.teachers.store'), [
        'firstName' => 'Ama',
        'lastName' => 'Mensah',
        'email' => 'ama.mensah.' . uniqid() . '@example.com',
        'phone' => '0244000000',
        'faculty' => $this->faculty->id,
        'department' => $this->department->id,
        'employeeId' => 'EMP' . uniqid(),
        'title' => 'Ms.',
        'staffType' => 'lecturer',
        'employmentStatus' => 'nss',
    ]);

    $response->assertRedirect(route('admin.teachers.index'));

    $teacher = Teacher::where('email', 'like', 'ama.mensah.%')->first();
    expect($teacher)->not->toBeNull();
    expect($teacher->staff_type)->toBe('lecturer');
    expect($teacher->employment_status)->toBe('nss');
    expect($teacher->employmentStatusLabel())->toBe('NSS Personnel');
});

it('requires a valid employment status', function () {
    $this->actingAs($this->admin)->post(route('admin.teachers.store'), [
        'firstName' => 'Kojo',
        'lastName' => 'Asante',
        'email' => 'kojo.asante.' . uniqid() . '@example.com',
        'phone' => '0244111111',
        'faculty' => $this->faculty->id,
        'department' => $this->department->id,
        'employeeId' => 'EMP' . uniqid(),
        'title' => 'Mr.',
        'staffType' => 'administrator',
        'employmentStatus' => 'contract',
    ])->assertSessionHasErrors('employmentStatus');
});

it('defaults existing staff employment status to permanent', function () {
    $teacher = Teacher::create([
        'first_name' => 'Existing',
        'last_name' => 'Staff',
        'email' => 'existing.' . uniqid() . '@example.com',
        'phone' => '0244222222',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'EMP' . uniqid(),
        'title' => 'Dr.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
    ]);

    expect($teacher->fresh()->employment_status)->toBe('permanent');
});
