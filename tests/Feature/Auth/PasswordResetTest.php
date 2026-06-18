<?php

use App\Models\Department;
use App\Models\Faculty;
use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;

test('reset password link screen can be rendered', function () {
    $this->get('/forgot-password')->assertOk();
});

test('login hides forgot password link when disabled in system settings', function () {
    SystemSetting::setValue('forgot_password_enabled', false);

    $this->get('/login')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('canResetPassword', false));
});

test('forgot password routes are blocked when disabled in system settings', function () {
    Notification::fake();
    SystemSetting::setValue('forgot_password_enabled', false);

    $this->get('/forgot-password')->assertRedirect(route('login'));

    $user = User::factory()->create();

    $this->post('/forgot-password', ['email' => $user->email])
        ->assertRedirect(route('login'));

    Notification::assertNothingSent();
});

test('reset password screen is blocked when forgot password is disabled', function () {
    Notification::fake();
    SystemSetting::setValue('forgot_password_enabled', true);

    $user = User::factory()->create();

    $this->post('/forgot-password', ['email' => $user->email]);

    Notification::assertSentTo($user, ResetPassword::class, function ($notification) use ($user) {
        SystemSetting::setValue('forgot_password_enabled', false);

        $this->get('/reset-password/' . $notification->token . '?email=' . urlencode($user->email) . '&account_type=admin')
            ->assertRedirect(route('login'));

        return true;
    });
});

test('admin user can request a password reset link', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->post('/forgot-password', ['email' => $user->email]);

    Notification::assertSentTo($user, ResetPassword::class);
});

test('teacher can request a password reset link', function () {
    Notification::fake();

    $faculty = Faculty::create(['name' => 'Reset Faculty']);
    $department = Department::create(['name' => 'Reset Dept', 'faculty_id' => $faculty->id]);

    $teacher = Teacher::create([
        'first_name' => 'Reset',
        'last_name' => 'Teacher',
        'email' => 'reset-teacher-' . uniqid() . '@example.com',
        'phone' => '1234567890',
        'faculty_id' => $faculty->id,
        'department_id' => $department->id,
        'employee_id' => 'RST' . uniqid(),
        'title' => 'Mr.',
        'password' => 'OldPassword123!',
    ]);

    $this->post('/forgot-password', ['email' => $teacher->email]);

    Notification::assertSentTo($teacher, ResetPassword::class);
});

test('reset password screen can be rendered for admin accounts', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->post('/forgot-password', ['email' => $user->email]);

    Notification::assertSentTo($user, ResetPassword::class, function ($notification) use ($user) {
        $response = $this->get('/reset-password/' . $notification->token . '?email=' . urlencode($user->email) . '&account_type=admin');

        $response->assertOk();

        return true;
    });
});

test('admin password can be reset with valid token', function () {
    Notification::fake();

    $user = User::factory()->create([
        'must_change_password' => true,
    ]);

    $this->post('/forgot-password', ['email' => $user->email]);

    Notification::assertSentTo($user, ResetPassword::class, function ($notification) use ($user) {
        $response = $this->post('/reset-password', [
            'token' => $notification->token,
            'email' => $user->email,
            'account_type' => 'admin',
            'password' => 'NewSecurePass123!',
            'password_confirmation' => 'NewSecurePass123!',
        ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('login'));

        $user->refresh();

        expect(Hash::check('NewSecurePass123!', $user->password))->toBeTrue()
            ->and($user->must_change_password)->toBeFalse()
            ->and($user->password_changed_at)->not->toBeNull();

        return true;
    });
});

test('teacher password can be reset with valid token', function () {
    Notification::fake();

    $faculty = Faculty::create(['name' => 'Reset Faculty 2']);
    $department = Department::create(['name' => 'Reset Dept 2', 'faculty_id' => $faculty->id]);

    $teacher = Teacher::create([
        'first_name' => 'Lecturer',
        'last_name' => 'Reset',
        'email' => 'lecturer-reset-' . uniqid() . '@example.com',
        'phone' => '1234567890',
        'faculty_id' => $faculty->id,
        'department_id' => $department->id,
        'employee_id' => 'LR' . uniqid(),
        'title' => 'Dr.',
        'password' => 'OldPassword123!',
    ]);

    $this->post('/forgot-password', ['email' => $teacher->email]);

    Notification::assertSentTo($teacher, ResetPassword::class, function ($notification) use ($teacher) {
        $response = $this->post('/reset-password', [
            'token' => $notification->token,
            'email' => $teacher->email,
            'account_type' => 'teacher',
            'password' => 'NewSecurePass123!',
            'password_confirmation' => 'NewSecurePass123!',
        ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('login'));

        $teacher->refresh();

        expect(Hash::check('NewSecurePass123!', $teacher->password))->toBeTrue()
            ->and($teacher->password_changed_at)->not->toBeNull();

        return true;
    });
});

test('forgot password does not reveal whether an email exists', function () {
    Notification::fake();

    $this->post('/forgot-password', ['email' => 'missing-' . uniqid() . '@example.com'])
        ->assertRedirect()
        ->assertSessionHas('status');

    Notification::assertNothingSent();
});
