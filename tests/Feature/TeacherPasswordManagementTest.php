<?php

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Teacher;
use App\Models\User;
use App\Notifications\TemporaryPasswordNotification;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Permission::firstOrCreate(['name' => 'admin.teachers.password-management', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.teachers.view', 'guard_name' => 'web']);

    $role = Role::firstOrCreate(['name' => 'Password Admin', 'guard_name' => 'web']);
    $role->givePermissionTo(['admin.teachers.password-management', 'admin.teachers.view']);

    $this->admin = User::factory()->create([
        'must_change_password' => false,
        'password_changed_at' => now(),
        'email_verified_at' => now(),
        'status' => User::STATUS_ACTIVE,
    ]);
    $this->admin->assignRole($role);

    $this->faculty = Faculty::create(['name' => 'Password Faculty']);
    $this->department = Department::create([
        'name' => 'Password Dept',
        'faculty_id' => $this->faculty->id,
    ]);

    $this->teacher = Teacher::create([
        'first_name' => 'Kwame',
        'last_name' => 'Nkrumah',
        'email' => 'kwame.password.' . uniqid() . '@example.com',
        'phone' => '0244000099',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'PWD' . uniqid(),
        'title' => 'Mr.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'password' => 'OldPassword123!',
    ]);
});

it('finds a staff member by employee_id on password management', function () {
    $this->actingAs($this->admin)
        ->get(route('admin.teachers.password-management', [
            'employee_id' => $this->teacher->employee_id,
        ]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('admin/teacher/password-management')
            ->where('teacher.id', $this->teacher->id)
            ->where('teacher.employee_id', $this->teacher->employee_id));
});

it('returns null teacher when employee_id is unknown', function () {
    $this->actingAs($this->admin)
        ->get(route('admin.teachers.password-management', [
            'employee_id' => 'DOES-NOT-EXIST',
        ]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('admin/teacher/password-management')
            ->where('teacher', null));
});

it('resets staff password without double hashing', function () {
    $this->actingAs($this->admin)
        ->post(route('admin.teachers.reset-password', $this->teacher))
        ->assertRedirect(route('admin.teachers.password-management', [
            'employee_id' => $this->teacher->employee_id,
        ]))
        ->assertSessionHas('generatedPassword')
        ->assertSessionHas('success');

    $temporaryPassword = session('generatedPassword');

    expect($temporaryPassword)->toBeString()->not->toBeEmpty();
    expect(Hash::check($temporaryPassword, $this->teacher->fresh()->password))->toBeTrue();
    expect($this->teacher->fresh()->password_changed_at)->toBeNull();
});

it('emails temporary credentials after a staff password reset', function () {
    Notification::fake();

    $this->actingAs($this->admin)
        ->post(route('admin.teachers.reset-password', $this->teacher))
        ->assertRedirect();

    $this->actingAs($this->admin)
        ->postJson(route('admin.teachers.share-password-email', $this->teacher))
        ->assertOk()
        ->assertJsonPath('success', true);

    Notification::assertSentTo($this->teacher, TemporaryPasswordNotification::class);

    $this->assertDatabaseHas('activity_logs', [
        'event_type' => 'teacher_password_shared_email',
    ]);
});

it('logs whatsapp share actions without storing the password', function () {
    $this->actingAs($this->admin)
        ->post(route('admin.teachers.reset-password', $this->teacher))
        ->assertRedirect();

    $this->actingAs($this->admin)
        ->postJson(route('admin.teachers.share-password-whatsapp', $this->teacher))
        ->assertOk()
        ->assertJsonPath('success', true);

    $log = \App\Models\ActivityLog::query()
        ->where('event_type', 'teacher_password_shared_whatsapp')
        ->latest('id')
        ->first();

    expect($log)->not->toBeNull();
    expect(json_encode($log->metadata))->not->toContain('password');
});

it('redirects get requests on the reset-password url to password management', function () {
    $this->actingAs($this->admin)
        ->get(route('admin.teachers.reset-password.show', $this->teacher))
        ->assertRedirect(route('admin.teachers.password-management', [
            'employee_id' => $this->teacher->employee_id,
        ]));
});

it('rejects credential sharing when no reset session exists', function () {
    $this->actingAs($this->admin)
        ->postJson(route('admin.teachers.share-password-email', $this->teacher))
        ->assertStatus(422);
});
