<?php

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Teacher;
use App\Models\User;
use App\Services\AttendancePortalService;
use Illuminate\Support\Facades\Auth;

test('login screen can be rendered', function () {
    $response = $this->get('/login');

    $response->assertStatus(200);
});

test('users can authenticate using the login screen', function () {
    $user = User::factory()->create();

    $response = $this->post('/login', [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $this->assertAuthenticated();
    $response->assertRedirect(route('admin.dashboard', absolute: false));
});

test('users can not authenticate with invalid password', function () {
    $user = User::factory()->create();

    $this->post('/login', [
        'email' => $user->email,
        'password' => 'wrong-password',
    ]);

    $this->assertGuest();
});

test('users can logout', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post('/logout');

    $this->assertGuest();
    $response->assertRedirect('/login');
});

test('users can authenticate with remember me', function () {
    $user = User::factory()->create();

    $response = $this->post('/login', [
        'email' => $user->email,
        'password' => 'password',
        'remember' => true,
    ]);

    $this->assertAuthenticated('web');
    $response->assertRedirect(route('admin.dashboard', absolute: false));
    $response->assertCookie(Auth::guard('web')->getRecallerName());

    $user->refresh();
    expect($user->remember_token)->not->toBeEmpty();
});

test('remember me cookie is not set when remember is unchecked', function () {
    $user = User::factory()->create();
    $originalToken = $user->remember_token;

    $response = $this->post('/login', [
        'email' => $user->email,
        'password' => 'password',
        'remember' => false,
    ]);

    $this->assertAuthenticated('web');
    $response->assertCookieMissing(Auth::guard('web')->getRecallerName());

    $user->refresh();
    expect($user->remember_token)->toBe($originalToken);
});

test('teachers can authenticate with remember me', function () {
    $faculty = Faculty::create(['name' => 'Remember Faculty '.uniqid()]);
    $department = Department::create([
        'name' => 'Remember Department '.uniqid(),
        'faculty_id' => $faculty->id,
    ]);

    $teacher = Teacher::create([
        'first_name' => 'Remember',
        'last_name' => 'Teacher',
        'email' => 'remember-teacher-'.uniqid().'@example.com',
        'phone' => '1234567890',
        'faculty_id' => $faculty->id,
        'department_id' => $department->id,
        'employee_id' => 'RMB'.uniqid(),
        'title' => 'Mr.',
        'password' => 'password',
    ]);

    $response = $this->post('/login', [
        'email' => $teacher->email,
        'password' => 'password',
        'remember' => true,
    ]);

    $this->assertAuthenticated('teacher');
    $response->assertRedirect(route('teacher.dashboard', absolute: false));
    $response->assertCookie(Auth::guard('teacher')->getRecallerName());

    $teacher->refresh();
    expect($teacher->remember_token)->not->toBeEmpty();
});

test('authenticated admins are sent from the home and login pages to the admin dashboard', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'web')
        ->get('/')
        ->assertRedirect(route('admin.dashboard', absolute: false));

    $this->actingAs($user, 'web')
        ->get('/login')
        ->assertRedirect(route('admin.dashboard', absolute: false));
});

test('authenticated teachers are sent from the home and login pages to the teacher dashboard', function () {
    $faculty = Faculty::create(['name' => 'Home Faculty '.uniqid()]);
    $department = Department::create([
        'name' => 'Home Department '.uniqid(),
        'faculty_id' => $faculty->id,
    ]);

    $teacher = Teacher::create([
        'first_name' => 'Home',
        'last_name' => 'Teacher',
        'email' => 'home-teacher-'.uniqid().'@example.com',
        'phone' => '1234567890',
        'faculty_id' => $faculty->id,
        'department_id' => $department->id,
        'employee_id' => 'HOM'.uniqid(),
        'title' => 'Mr.',
        'password' => 'password',
    ]);

    $this->actingAs($teacher, 'teacher')
        ->get('/')
        ->assertRedirect(route('teacher.dashboard', absolute: false));

    $this->actingAs($teacher, 'teacher')
        ->get('/login')
        ->assertRedirect(route('teacher.dashboard', absolute: false));
});

test('a login session is still recognized when the user later visits the home url', function () {
    $user = User::factory()->create();

    $this->post('/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->assertRedirect(route('admin.dashboard', absolute: false));

    $this->assertAuthenticated('web');

    $this->get('/')
        ->assertRedirect(route('admin.dashboard', absolute: false));

    $this->get(route('admin.dashboard', absolute: false))
        ->assertOk();
});

test('admins who must change their password are sent to the password form', function () {
    $user = User::factory()->create([
        'must_change_password' => true,
    ]);

    $this->actingAs($user, 'web')
        ->get('/')
        ->assertRedirect(route('password.edit', absolute: false));
});

test('header home path is the admin dashboard for authenticated admins', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'web')
        ->get(route('admin.dashboard', absolute: false))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('auth.home', route('admin.dashboard', absolute: false)));
});

test('header home path is the teacher dashboard for authenticated teachers', function () {
    $faculty = Faculty::create(['name' => 'Logo Faculty '.uniqid()]);
    $department = Department::create([
        'name' => 'Logo Department '.uniqid(),
        'faculty_id' => $faculty->id,
    ]);

    $teacher = Teacher::create([
        'first_name' => 'Logo',
        'last_name' => 'Teacher',
        'email' => 'logo-teacher-'.uniqid().'@example.com',
        'phone' => '1234567890',
        'faculty_id' => $faculty->id,
        'department_id' => $department->id,
        'employee_id' => 'LGO'.uniqid(),
        'title' => 'Mr.',
        'password' => 'password',
    ]);

    $this->actingAs($teacher, 'teacher')
        ->get(route('teacher.help-desk.index', absolute: false))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('auth.home', route('teacher.dashboard', absolute: false)));
});

test('attendance portal sessions are sent from home to the portal', function () {
    $faculty = Faculty::create(['name' => 'Portal Home Faculty '.uniqid()]);
    $department = Department::create([
        'name' => 'Portal Home Department '.uniqid(),
        'faculty_id' => $faculty->id,
    ]);

    $teacher = Teacher::create([
        'first_name' => 'Portal',
        'last_name' => 'Home',
        'email' => 'portal-home-'.uniqid().'@example.com',
        'phone' => '1234567890',
        'faculty_id' => $faculty->id,
        'department_id' => $department->id,
        'employee_id' => 'PHM'.uniqid(),
        'title' => 'Mr.',
        'password' => 'password',
    ]);

    $this->actingAs($teacher, 'teacher')
        ->withSession([
            AttendancePortalService::SESSION_KEY => [
                'teacher_id' => $teacher->id,
                'employee_id' => $teacher->employee_id,
                'staff_type' => $teacher->staff_type,
                'started_at' => now()->timestamp,
                'last_activity_at' => now()->timestamp,
            ],
        ])
        ->get('/')
        ->assertRedirect(route('attendance.portal', absolute: false));
});
