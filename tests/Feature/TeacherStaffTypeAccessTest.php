<?php

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Teacher;

function makeTeacherForStaffType(string $staffType): Teacher
{
    $faculty = Faculty::create(['name' => 'Staff Type Faculty ' . $staffType . uniqid()]);
    $department = Department::create([
        'name' => 'Staff Type Department ' . $staffType . uniqid(),
        'faculty_id' => $faculty->id,
    ]);

    return Teacher::create([
        'first_name' => ucfirst($staffType),
        'last_name' => 'User',
        'email' => $staffType . uniqid() . '@example.com',
        'phone' => '1234567890',
        'faculty_id' => $faculty->id,
        'department_id' => $department->id,
        'employee_id' => strtoupper($staffType) . uniqid(),
        'title' => 'Mr.',
        'staff_type' => $staffType,
    ]);
}

it('allows lecturers to view class attendance pages', function () {
    $lecturer = makeTeacherForStaffType(Teacher::STAFF_TYPE_LECTURER);

    $this->actingAs($lecturer, 'teacher')
        ->get('/teacher/attendance')
        ->assertOk();
});

it('blocks administrator staff from lecturer class attendance pages', function () {
    $administrator = makeTeacherForStaffType(Teacher::STAFF_TYPE_ADMINISTRATOR);

    $this->actingAs($administrator, 'teacher')
        ->get('/teacher/attendance')
        ->assertForbidden();
});

it('allows administrator staff to view staff attendance pages', function () {
    $administrator = makeTeacherForStaffType(Teacher::STAFF_TYPE_ADMINISTRATOR);

    $this->actingAs($administrator, 'teacher')
        ->get('/teacher/staff-attendance')
        ->assertOk();
});
