<?php

use App\Models\ActivityLog;
use App\Models\User;
use App\Notifications\AdminUserWelcomeNotification;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Permission::firstOrCreate(['name' => 'admin.user-management.users.view', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.user-management.users.create', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.user-management.users.edit', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.user-management.users.delete', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.user-management.users.reset-password', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.user-management.users.export', 'guard_name' => 'web']);

    $this->adminRole = Role::firstOrCreate(['name' => 'Super Admin', 'guard_name' => 'web']);
    $this->adminRole->givePermissionTo([
        'admin.user-management.users.view',
        'admin.user-management.users.create',
        'admin.user-management.users.edit',
        'admin.user-management.users.delete',
        'admin.user-management.users.reset-password',
        'admin.user-management.users.export',
    ]);

    $this->admin = User::factory()->create([
        'staff_id' => 'ADM' . uniqid(),
        'status' => User::STATUS_ACTIVE,
    ]);
    $this->admin->assignRole($this->adminRole);

    $this->targetUser = User::factory()->create([
        'staff_id' => 'USR' . uniqid(),
        'status' => User::STATUS_ACTIVE,
        'password' => 'OldPassword123!',
    ]);
    $this->targetUser->assignRole($this->adminRole);
});

it('requires permission to view user management index', function () {
    $unauthorized = User::factory()->create(['staff_id' => 'NOPE' . uniqid()]);

    $this->actingAs($unauthorized)
        ->get(route('admin.user-management.users.index'))
        ->assertForbidden();
});

it('loads user management index with summary cards and paginated users', function () {
    $response = $this->actingAs($this->admin)
        ->get(route('admin.user-management.users.index'));

    $response->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('admin/user/index')
            ->has('summaryCards')
            ->has('users.data')
            ->has('roles')
            ->has('filters')
            ->has('statusOptions')
        );
});

it('creates a user with a generated temporary password and force change flag', function () {
    $email = 'new-admin-' . uniqid() . '@example.com';

    $response = $this->actingAs($this->admin)->post(route('admin.user-management.users.store'), [
        'name' => 'New Admin',
        'email' => $email,
        'staff_id' => 'NEW' . uniqid(),
        'roles' => ['Super Admin'],
        'status' => User::STATUS_ACTIVE,
    ]);

    $response->assertRedirect(route('admin.user-management.users.index'))
        ->assertSessionHas('generatedPassword');

    $created = User::query()->where('email', $email)->first();

    expect($created)->not->toBeNull()
        ->and($created->must_change_password)->toBeTrue()
        ->and(Hash::check('Password123!', $created->password))->toBeFalse();
});

it('deletes a user using the correct route', function () {
    $user = User::factory()->create(['staff_id' => 'DEL' . uniqid()]);
    $user->assignRole($this->adminRole);

    $this->actingAs($this->admin)
        ->delete(route('admin.user-management.users.destroy', $user))
        ->assertRedirect(route('admin.user-management.users.index'));

    $this->assertDatabaseMissing('users', ['id' => $user->id]);
});

it('prevents deleting your own account', function () {
    $this->actingAs($this->admin)
        ->delete(route('admin.user-management.users.destroy', $this->admin))
        ->assertForbidden();
});

it('resets another users password without logging plaintext password', function () {
    $oldHash = $this->targetUser->password;

    $response = $this->actingAs($this->admin)->postJson(route('admin.user-management.users.reset-password', $this->targetUser), [
        'mode' => 'generate',
        'force_change_on_login' => true,
        'send_reset_link' => false,
    ]);

    $response->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonStructure(['data' => ['temporary_password']]);

    $this->targetUser->refresh();

    expect($this->targetUser->password)->not->toBe($oldHash)
        ->and($this->targetUser->must_change_password)->toBeTrue();

    $log = ActivityLog::query()->where('event_type', 'admin_password_reset')->latest()->first();

    expect($log)->not->toBeNull()
        ->and(json_encode($log->metadata))->not->toContain($response->json('data.temporary_password'));
});

it('prevents resetting your own password through admin reset endpoint', function () {
    $this->actingAs($this->admin)->postJson(route('admin.user-management.users.reset-password', $this->admin), [
        'mode' => 'generate',
        'force_change_on_login' => true,
    ])->assertForbidden();
});

it('returns quick view payload for authorized admins', function () {
    $this->actingAs($this->admin)
        ->getJson(route('admin.user-management.users.quick-view', $this->targetUser))
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonStructure([
            'data' => [
                'profile',
                'security',
                'permissions',
                'activity',
            ],
        ]);
});

it('exports users as csv for authorized admins', function () {
    $this->actingAs($this->admin)
        ->get(route('admin.user-management.users.export', 'csv'))
        ->assertOk();
});

it('redirects admins with pending password change away from protected pages', function () {
    $this->admin->update(['must_change_password' => true]);

    $this->actingAs($this->admin)
        ->get(route('admin.user-management.users.index'))
        ->assertRedirect(route('password.edit'));
});

it('allows forced password change without current password and clears the flag', function () {
    $this->admin->update(['must_change_password' => true]);

    $this->actingAs($this->admin)
        ->put(route('password.update'), [
            'password' => 'NewSecurePass123!',
            'password_confirmation' => 'NewSecurePass123!',
        ])
        ->assertRedirect(route('admin.dashboard'));

    $this->admin->refresh();

    expect($this->admin->must_change_password)->toBeFalse()
        ->and($this->admin->password_changed_at)->not->toBeNull()
        ->and(Hash::check('NewSecurePass123!', $this->admin->password))->toBeTrue();
});

it('can optionally send welcome email when creating a user', function () {
    Notification::fake();

    $email = 'welcome-' . uniqid() . '@example.com';

    $this->actingAs($this->admin)->post(route('admin.user-management.users.store'), [
        'name' => 'Welcome User',
        'email' => $email,
        'staff_id' => 'WEL' . uniqid(),
        'roles' => ['Super Admin'],
        'status' => User::STATUS_ACTIVE,
        'send_welcome_email' => true,
    ])->assertRedirect();

    $created = User::query()->where('email', $email)->first();

    Notification::assertSentTo($created, AdminUserWelcomeNotification::class);
});

it('supports bulk status updates for selected users', function () {
    $other = User::factory()->create([
        'staff_id' => 'BLK' . uniqid(),
        'status' => User::STATUS_ACTIVE,
    ]);
    $other->assignRole($this->adminRole);

    $this->actingAs($this->admin)->postJson(route('admin.user-management.users.bulk.status'), [
        'ids' => [$other->id],
        'status' => User::STATUS_INACTIVE,
    ])->assertOk()->assertJsonPath('data.updated', 1);

    expect($other->fresh()->status)->toBe(User::STATUS_INACTIVE);
});

it('supports bulk password change requirement', function () {
    $other = User::factory()->create([
        'staff_id' => 'PWD' . uniqid(),
        'must_change_password' => false,
    ]);
    $other->assignRole($this->adminRole);

    $this->actingAs($this->admin)->postJson(route('admin.user-management.users.bulk.require-password-change'), [
        'ids' => [$other->id],
    ])->assertOk()->assertJsonPath('data.updated', 1);

    expect($other->fresh()->must_change_password)->toBeTrue();
});
