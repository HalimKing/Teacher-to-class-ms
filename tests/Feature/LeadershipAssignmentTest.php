<?php

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Teacher;
use App\Models\User;
use App\Support\LeadershipAssignment;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

function makeLeadershipTeacher(Faculty $faculty, Department $department, array $overrides = []): Teacher
{
    return Teacher::create(array_merge([
        'first_name' => 'Unit',
        'last_name' => 'Staff',
        'email' => 'unit-staff-'.uniqid().'@example.com',
        'phone' => '0244000000',
        'faculty_id' => $faculty->id,
        'department_id' => $department->id,
        'employee_id' => 'LDR'.uniqid(),
        'title' => 'Mr.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'password' => 'password',
    ], $overrides));
}

beforeEach(function () {
    Permission::firstOrCreate(['name' => 'admin.teachers.create', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.teachers.edit', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.teachers.view', 'guard_name' => 'web']);

    $role = Role::firstOrCreate(['name' => 'Super Admin', 'guard_name' => 'web']);
    $role->givePermissionTo(['admin.teachers.create', 'admin.teachers.edit', 'admin.teachers.view']);

    $this->admin = User::factory()->create();
    $this->admin->assignRole($role);

    $this->facultyA = Faculty::create(['name' => 'Leadership Faculty A '.uniqid()]);
    $this->facultyB = Faculty::create(['name' => 'Leadership Faculty B '.uniqid()]);
    $this->departmentA1 = Department::create([
        'name' => 'Dept A1 '.uniqid(),
        'faculty_id' => $this->facultyA->id,
    ]);
    $this->departmentA2 = Department::create([
        'name' => 'Dept A2 '.uniqid(),
        'faculty_id' => $this->facultyA->id,
    ]);
    $this->departmentB1 = Department::create([
        'name' => 'Dept B1 '.uniqid(),
        'faculty_id' => $this->facultyB->id,
    ]);
});

it('lets a higher-level administrator assign and clear leadership without replacing staff type', function () {
    $payload = [
        'firstName' => 'Ama',
        'lastName' => 'Dean',
        'email' => 'ama.dean.'.uniqid().'@example.com',
        'phone' => '0244111111',
        'faculty' => $this->facultyA->id,
        'department' => $this->departmentA1->id,
        'employeeId' => 'EMP'.uniqid(),
        'title' => 'Dr.',
        'staffType' => 'lecturer',
        'employmentStatus' => 'permanent',
        'leadershipRole' => LeadershipAssignment::DIRECTOR_DEAN,
        'leadershipFaculty' => $this->facultyA->id,
    ];

    $this->actingAs($this->admin)
        ->post(route('admin.teachers.store'), $payload)
        ->assertRedirect(route('admin.teachers.index'));

    $teacher = Teacher::where('email', $payload['email'])->first();
    expect($teacher)->not->toBeNull()
        ->and($teacher->staff_type)->toBe(Teacher::STAFF_TYPE_LECTURER)
        ->and($teacher->isDirectorDean())->toBeTrue()
        ->and($teacher->leadership_faculty_id)->toBe($this->facultyA->id)
        ->and($teacher->leadership_department_id)->toBeNull();

    $this->actingAs($this->admin)
        ->put(route('admin.teachers.update', $teacher), [
            ...$payload,
            'firstName' => 'Ama',
            'leadershipRole' => '',
            'leadershipFaculty' => null,
            'leadershipDepartment' => null,
        ])
        ->assertRedirect(route('admin.teachers.index'));

    $teacher->refresh();
    expect($teacher->staff_type)->toBe(Teacher::STAFF_TYPE_LECTURER)
        ->and($teacher->hasLeadershipAssignment())->toBeFalse();
});

it('rejects a head of department assignment when the department is outside the selected faculty', function () {
    $this->actingAs($this->admin)
        ->post(route('admin.teachers.store'), [
            'firstName' => 'Kojo',
            'lastName' => 'Head',
            'email' => 'kojo.head.'.uniqid().'@example.com',
            'phone' => '0244222222',
            'faculty' => $this->facultyA->id,
            'department' => $this->departmentA1->id,
            'employeeId' => 'EMP'.uniqid(),
            'title' => 'Mr.',
            'staffType' => 'administrator',
            'employmentStatus' => 'permanent',
            'leadershipRole' => LeadershipAssignment::HEAD_OF_DEPARTMENT,
            'leadershipFaculty' => $this->facultyA->id,
            'leadershipDepartment' => $this->departmentB1->id,
        ])
        ->assertSessionHasErrors('leadershipDepartment');
});

it('keeps ordinary lecturers on their original routes and blocks unit management', function () {
    $lecturer = makeLeadershipTeacher($this->facultyA, $this->departmentA1);

    $this->actingAs($lecturer, 'teacher')
        ->get(route('teacher.attendance'))
        ->assertOk();

    $this->actingAs($lecturer, 'teacher')
        ->get(route('teacher.unit.staff.index'))
        ->assertForbidden();

    $this->actingAs($lecturer, 'teacher')
        ->get(route('teacher.staff-attendance'))
        ->assertForbidden();
});

it('lets a lecturer who is director or dean manage only staff in their faculty', function () {
    $dean = makeLeadershipTeacher($this->facultyA, $this->departmentA1, [
        'first_name' => 'Dean',
        'leadership_role' => LeadershipAssignment::DIRECTOR_DEAN,
        'leadership_faculty_id' => $this->facultyA->id,
    ]);
    $sameFaculty = makeLeadershipTeacher($this->facultyA, $this->departmentA2, ['first_name' => 'InFaculty']);
    $otherFaculty = makeLeadershipTeacher($this->facultyB, $this->departmentB1, ['first_name' => 'OutFaculty']);

    $this->actingAs($dean, 'teacher')
        ->get(route('teacher.attendance'))
        ->assertOk();

    $this->actingAs($dean, 'teacher')
        ->get(route('teacher.unit.staff.index'))
        ->assertOk()
        ->assertSee('InFaculty')
        ->assertDontSee('OutFaculty');

    $this->actingAs($dean, 'teacher')
        ->get(route('teacher.unit.staff.edit', $sameFaculty))
        ->assertOk();

    $this->actingAs($dean, 'teacher')
        ->get(route('teacher.unit.staff.edit', $otherFaculty))
        ->assertForbidden();

    $this->actingAs($dean, 'teacher')
        ->get(route('teacher.unit.attendance.index', ['teacher_id' => $otherFaculty->id]))
        ->assertForbidden();
});

it('lets a lecturer who is head of department manage only staff in their department', function () {
    $head = makeLeadershipTeacher($this->facultyA, $this->departmentA1, [
        'first_name' => 'Head',
        'leadership_role' => LeadershipAssignment::HEAD_OF_DEPARTMENT,
        'leadership_faculty_id' => $this->facultyA->id,
        'leadership_department_id' => $this->departmentA1->id,
    ]);
    $sameDepartment = makeLeadershipTeacher($this->facultyA, $this->departmentA1, ['first_name' => 'SameDept']);
    $sameFacultyOtherDept = makeLeadershipTeacher($this->facultyA, $this->departmentA2, ['first_name' => 'OtherDept']);

    $this->actingAs($head, 'teacher')
        ->get(route('teacher.attendance'))
        ->assertOk();

    $this->actingAs($head, 'teacher')
        ->get(route('teacher.unit.staff.index'))
        ->assertOk()
        ->assertSee('SameDept')
        ->assertDontSee('OtherDept');

    $this->actingAs($head, 'teacher')
        ->get(route('teacher.unit.staff.edit', $sameDepartment))
        ->assertOk();

    $this->actingAs($head, 'teacher')
        ->get(route('teacher.unit.staff.edit', $sameFacultyOtherDept))
        ->assertForbidden();
});

it('keeps ordinary administrators on staff attendance and blocks unit management', function () {
    $administrator = makeLeadershipTeacher($this->facultyA, $this->departmentA1, [
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
    ]);

    $this->actingAs($administrator, 'teacher')
        ->get(route('teacher.staff-attendance'))
        ->assertOk();

    $this->actingAs($administrator, 'teacher')
        ->get(route('teacher.attendance'))
        ->assertForbidden();

    $this->actingAs($administrator, 'teacher')
        ->get(route('teacher.unit.staff.index'))
        ->assertForbidden();
});

it('lets an administrator who is director or dean keep staff attendance and manage faculty staff', function () {
    $dean = makeLeadershipTeacher($this->facultyA, $this->departmentA1, [
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
        'leadership_role' => LeadershipAssignment::DIRECTOR_DEAN,
        'leadership_faculty_id' => $this->facultyA->id,
    ]);
    $sameFaculty = makeLeadershipTeacher($this->facultyA, $this->departmentA2);
    $otherFaculty = makeLeadershipTeacher($this->facultyB, $this->departmentB1);

    $this->actingAs($dean, 'teacher')
        ->get(route('teacher.staff-attendance'))
        ->assertOk();

    $this->actingAs($dean, 'teacher')
        ->get(route('teacher.unit.staff.index'))
        ->assertOk();

    $this->actingAs($dean, 'teacher')
        ->put(route('teacher.unit.staff.update', $otherFaculty), [
            'firstName' => 'Blocked',
            'lastName' => 'Staff',
            'email' => $otherFaculty->email,
            'phone' => $otherFaculty->phone,
            'faculty' => $otherFaculty->faculty_id,
            'department' => $otherFaculty->department_id,
            'employeeId' => $otherFaculty->employee_id,
            'title' => $otherFaculty->title,
            'staffType' => $otherFaculty->staff_type,
            'employmentStatus' => $otherFaculty->employment_status,
        ])
        ->assertForbidden();

    $this->actingAs($dean, 'teacher')
        ->put(route('teacher.unit.staff.update', $sameFaculty), [
            'firstName' => 'Updated',
            'lastName' => $sameFaculty->last_name,
            'email' => $sameFaculty->email,
            'phone' => $sameFaculty->phone,
            'faculty' => $sameFaculty->faculty_id,
            'department' => $sameFaculty->department_id,
            'employeeId' => $sameFaculty->employee_id,
            'title' => $sameFaculty->title,
            'staffType' => $sameFaculty->staff_type,
            'employmentStatus' => $sameFaculty->employment_status,
        ])
        ->assertRedirect(route('teacher.unit.staff.index'));

    expect($sameFaculty->fresh()->first_name)->toBe('Updated');
});

it('lets an administrator who is head of department keep staff attendance and stay inside the department', function () {
    $head = makeLeadershipTeacher($this->facultyA, $this->departmentA1, [
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
        'leadership_role' => LeadershipAssignment::HEAD_OF_DEPARTMENT,
        'leadership_faculty_id' => $this->facultyA->id,
        'leadership_department_id' => $this->departmentA1->id,
    ]);
    $outside = makeLeadershipTeacher($this->facultyA, $this->departmentA2);

    $this->actingAs($head, 'teacher')
        ->get(route('teacher.staff-attendance'))
        ->assertOk();

    $this->actingAs($head, 'teacher')
        ->get(route('teacher.unit.attendance.index'))
        ->assertOk();

    $this->actingAs($head, 'teacher')
        ->get(route('teacher.unit.staff.quick-view', $outside))
        ->assertForbidden();
});

it('stops unit access after leadership is removed and still lets a full administrator see every faculty', function () {
    $formerDean = makeLeadershipTeacher($this->facultyA, $this->departmentA1, [
        'leadership_role' => LeadershipAssignment::DIRECTOR_DEAN,
        'leadership_faculty_id' => $this->facultyA->id,
    ]);
    $otherFaculty = makeLeadershipTeacher($this->facultyB, $this->departmentB1, ['first_name' => 'VisibleToAdmin']);

    $formerDean->update([
        'leadership_role' => null,
        'leadership_faculty_id' => null,
        'leadership_department_id' => null,
    ]);

    $this->actingAs($formerDean, 'teacher')
        ->get(route('teacher.unit.staff.index'))
        ->assertForbidden();

    auth('teacher')->logout();

    $this->actingAs($this->admin, 'web')
        ->get(route('admin.teachers.index'))
        ->assertOk()
        ->assertSee('VisibleToAdmin');
});
