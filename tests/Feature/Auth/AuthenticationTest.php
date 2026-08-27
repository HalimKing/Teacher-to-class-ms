<?php

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Teacher;
use App\Models\User;
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
    $response->assertRedirect(route('dashboard', absolute: false));
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
    $response->assertRedirect('/');
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