<?php

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Permission::firstOrCreate(['name' => 'admin.teachers.view', 'guard_name' => 'web']);

    $role = Role::firstOrCreate(['name' => 'Super Admin', 'guard_name' => 'web']);
    $role->givePermissionTo(['admin.teachers.view']);

    $this->admin = User::factory()->create();
    $this->admin->assignRole($role);

    $this->faculty = Faculty::create(['name' => 'Index Faculty']);
    $this->department = Department::create([
        'name' => 'Index Dept',
        'faculty_id' => $this->faculty->id,
    ]);
});

function makeStaffMember(Faculty $faculty, Department $department, array $overrides = []): Teacher
{
    return Teacher::create(array_merge([
        'first_name' => 'Ama',
        'last_name' => 'Mensah',
        'email' => 'ama.mensah.' . uniqid() . '@example.com',
        'phone' => '0244000000',
        'faculty_id' => $faculty->id,
        'department_id' => $department->id,
        'employee_id' => 'EMP' . uniqid(),
        'title' => 'Ms.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'employment_status' => Teacher::EMPLOYMENT_STATUS_PERMANENT,
    ], $overrides));
}

it('loads the all staff index', function () {
    makeStaffMember($this->faculty, $this->department);

    $this->actingAs($this->admin)
        ->get(route('admin.teachers.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('admin/teacher/index')
            ->has('summaryCards')
            ->has('teachers.data', 1)
            ->has('faculties')
            ->has('departments')
            ->has('filters')
        );
});

it('loads the all staff index when a face descriptor cannot be decrypted', function () {
    $teacher = makeStaffMember($this->faculty, $this->department);

    DB::table('teachers')->where('id', $teacher->id)->update([
        'face_descriptor' => 'invalid-laravel-encrypted-payload',
        'face_registered_at' => now(),
    ]);

    expect(fn () => Teacher::find($teacher->id)?->face_descriptor)->not->toThrow(Throwable::class);
    expect(Teacher::find($teacher->id)?->face_descriptor)->toBeNull();
    expect(Teacher::find($teacher->id)?->faceEnrollmentStatus())->toBe('enrolled');

    $this->actingAs($this->admin)
        ->get(route('admin.teachers.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('admin/teacher/index')
            ->has('teachers.data', 1)
            ->where('teachers.data.0.face_enrollment_status', 'enrolled')
        );
});
