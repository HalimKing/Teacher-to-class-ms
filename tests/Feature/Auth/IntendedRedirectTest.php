<?php

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Teacher;
use App\Models\User;
use App\Support\LeadershipAssignment;

function makeIntendedRedirectTeacher(array $overrides = []): Teacher
{
    $faculty = Faculty::create(['name' => 'Intended Faculty '.uniqid()]);
    $department = Department::create([
        'name' => 'Intended Department '.uniqid(),
        'faculty_id' => $faculty->id,
    ]);

    return Teacher::create(array_merge([
        'first_name' => 'Intended',
        'last_name' => 'Staff',
        'email' => 'intended-'.uniqid().'@example.com',
        'phone' => '1234567890',
        'faculty_id' => $faculty->id,
        'department_id' => $department->id,
        'employee_id' => 'INT'.uniqid(),
        'title' => 'Mr.',
        'password' => 'password',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'leadership_faculty_id' => $faculty->id,
        'leadership_department_id' => $department->id,
    ], $overrides));
}

it('returns lecturers to the protected page they requested before login', function () {
    $teacher = makeIntendedRedirectTeacher();
    $url = '/teacher/help-desk?status=open';

    $this->get($url)->assertRedirect(route('login'));

    $this->post('/login', [
        'email' => $teacher->email,
        'password' => 'password',
    ])->assertRedirect($url);
});

it('returns administrators to the protected page they requested before login', function () {
    $user = User::factory()->create();
    $url = '/admin/dashboard';

    $this->get($url)->assertRedirect(route('login'));

    $this->post('/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->assertRedirect($url);
});

it('returns deans to their unit page after login', function () {
    $dean = makeIntendedRedirectTeacher([
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'leadership_role' => LeadershipAssignment::DIRECTOR_DEAN,
    ]);
    $url = '/teacher/unit/staff';

    $this->get($url)->assertRedirect(route('login'));

    $this->post('/login', [
        'email' => $dean->email,
        'password' => 'password',
    ])->assertRedirect($url);
});

it('returns heads of department to their unit page after login', function () {
    $hod = makeIntendedRedirectTeacher([
        'leadership_role' => LeadershipAssignment::HEAD_OF_DEPARTMENT,
    ]);
    $url = '/teacher/unit/attendance';

    $this->get($url)->assertRedirect(route('login'));

    $this->post('/login', [
        'email' => $hod->email,
        'password' => 'password',
    ])->assertRedirect($url);
});

it('returns administrator staff to staff attendance after login', function () {
    $staff = makeIntendedRedirectTeacher([
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
        'leadership_role' => null,
        'leadership_faculty_id' => null,
        'leadership_department_id' => null,
    ]);
    $url = '/teacher/staff-attendance';

    $this->get($url)->assertRedirect(route('login'));

    $this->post('/login', [
        'email' => $staff->email,
        'password' => 'password',
    ])->assertRedirect($url);
});

it('sends a direct login visit to the role dashboard when there is no intended url', function () {
    $teacher = makeIntendedRedirectTeacher();

    $this->post('/login', [
        'email' => $teacher->email,
        'password' => 'password',
    ])->assertRedirect(route('teacher.dashboard', absolute: false));
});

it('does not send teachers to an admin url stored as intended', function () {
    $teacher = makeIntendedRedirectTeacher();

    $this->withSession(['url.intended' => url('/admin/teachers')])
        ->post('/login', [
            'email' => $teacher->email,
            'password' => 'password',
        ])
        ->assertRedirect(route('teacher.dashboard', absolute: false));
});

it('rejects an external intended url', function () {
    $user = User::factory()->create();

    $this->withSession(['url.intended' => 'https://evil.example/phish'])
        ->post('/login', [
            'email' => $user->email,
            'password' => 'password',
        ])
        ->assertRedirect(route('admin.dashboard', absolute: false));
});

it('rejects a protocol-relative intended url', function () {
    $user = User::factory()->create();

    $this->withSession(['url.intended' => '//evil.example/phish'])
        ->post('/login', [
            'email' => $user->email,
            'password' => 'password',
        ])
        ->assertRedirect(route('admin.dashboard', absolute: false));
});

it('keeps an already authenticated user on a protected page', function () {
    $teacher = makeIntendedRedirectTeacher();

    $this->actingAs($teacher, 'teacher')
        ->get('/teacher/help-desk')
        ->assertOk();
});

it('stores the intended search url through auth.any', function () {
    $user = User::factory()->create();
    $url = '/search?q=inbox';

    $this->get($url)->assertRedirect(route('login'));

    $this->post('/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->assertRedirect($url);
});

it('still forces a password change before honoring an intended admin page', function () {
    $user = User::factory()->create([
        'must_change_password' => true,
    ]);

    $this->get('/admin/dashboard')->assertRedirect(route('login'));

    $this->post('/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->assertRedirect(route('password.edit', absolute: false));
});
