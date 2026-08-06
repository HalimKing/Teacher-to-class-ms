<?php

use App\Models\Department;
use App\Models\Faculty;
use App\Models\HelpDeskTicket;
use App\Models\Teacher;
use App\Models\User;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Permission::firstOrCreate(['name' => 'admin.help-desk.view', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.help-desk.manage', 'guard_name' => 'web']);

    $role = Role::firstOrCreate(['name' => 'Super Admin', 'guard_name' => 'web']);
    $role->givePermissionTo(['admin.help-desk.view', 'admin.help-desk.manage']);

    $this->admin = User::factory()->create([
        'must_change_password' => false,
        'password_changed_at' => now(),
        'email_verified_at' => now(),
        'status' => User::STATUS_ACTIVE,
    ]);
    $this->admin->assignRole($role);

    $this->unauthorizedAdmin = User::factory()->create([
        'must_change_password' => false,
        'password_changed_at' => now(),
        'email_verified_at' => now(),
        'status' => User::STATUS_ACTIVE,
    ]);

    $this->faculty = Faculty::create(['name' => 'Help Desk Faculty']);
    $this->department = Department::create([
        'name' => 'Help Desk Dept',
        'faculty_id' => $this->faculty->id,
    ]);

    $this->teacher = Teacher::create([
        'first_name' => 'Help',
        'last_name' => 'Requester',
        'email' => 'help.requester.' . uniqid() . '@example.com',
        'phone' => '0244000001',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'HD' . uniqid(),
        'title' => 'Mr.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
    ]);

    $this->otherTeacher = Teacher::create([
        'first_name' => 'Other',
        'last_name' => 'Staff',
        'email' => 'other.staff.' . uniqid() . '@example.com',
        'phone' => '0244000002',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'OS' . uniqid(),
        'title' => 'Ms.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
    ]);
});

it('allows a teacher to create a ticket and see only their own tickets', function () {
    $this->actingAs($this->teacher, 'teacher')
        ->post(route('teacher.help-desk.store'), [
            'subject' => 'Cannot mark attendance',
            'description' => 'The check-in button is not responding on mobile.',
            'category' => 'technical',
            'priority' => 'high',
        ])
        ->assertRedirect();

    $ticket = HelpDeskTicket::first();
    expect($ticket)->not->toBeNull();
    expect($ticket->created_by)->toBe($this->teacher->id);
    expect($ticket->ticket_number)->toStartWith('HD-');
    expect($ticket->status)->toBe(HelpDeskTicket::STATUS_OPEN);

    HelpDeskTicket::create([
        'ticket_number' => 'HD-OTHER-0001',
        'subject' => 'Other ticket',
        'description' => 'Should not be visible',
        'category' => 'other',
        'priority' => 'low',
        'status' => HelpDeskTicket::STATUS_OPEN,
        'created_by' => $this->otherTeacher->id,
    ]);

    $this->actingAs($this->teacher, 'teacher')
        ->get(route('teacher.help-desk.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('teacher/help-desk/index')
            ->has('tickets.data', 1)
            ->where('tickets.data.0.subject', 'Cannot mark attendance'));
});

it('allows an admin with permission to list, assign, update status, and comment', function () {
    $ticket = HelpDeskTicket::create([
        'ticket_number' => 'HD-TEST-0001',
        'subject' => 'Account locked',
        'description' => 'I cannot sign in.',
        'category' => 'account',
        'priority' => 'urgent',
        'status' => HelpDeskTicket::STATUS_OPEN,
        'created_by' => $this->teacher->id,
    ]);

    $this->actingAs($this->admin)
        ->get(route('admin.help-desk.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('admin/help-desk/index')->has('tickets.data', 1));

    $this->actingAs($this->admin)
        ->post(route('admin.help-desk.assign', $ticket), [
            'assigned_to' => $this->admin->id,
        ])
        ->assertRedirect();

    expect($ticket->fresh()->assigned_to)->toBe($this->admin->id);
    expect($ticket->fresh()->status)->toBe(HelpDeskTicket::STATUS_IN_PROGRESS);

    $this->actingAs($this->admin)
        ->post(route('admin.help-desk.status', $ticket), [
            'status' => HelpDeskTicket::STATUS_RESOLVED,
        ])
        ->assertRedirect();

    expect($ticket->fresh()->status)->toBe(HelpDeskTicket::STATUS_RESOLVED);

    $this->actingAs($this->admin)
        ->post(route('admin.help-desk.comment', $ticket), [
            'body' => 'Please try resetting your password.',
        ])
        ->assertRedirect();

    expect($ticket->comments()->count())->toBe(1);
});

it('allows a teacher to reply and close a resolved ticket', function () {
    $ticket = HelpDeskTicket::create([
        'ticket_number' => 'HD-TEST-0002',
        'subject' => 'Need access',
        'description' => 'Please grant access to reports.',
        'category' => 'system_request',
        'priority' => 'medium',
        'status' => HelpDeskTicket::STATUS_RESOLVED,
        'created_by' => $this->teacher->id,
        'resolved_at' => now(),
    ]);

    $this->actingAs($this->teacher, 'teacher')
        ->post(route('teacher.help-desk.comment', $ticket), [
            'body' => 'Thanks, access works now.',
        ])
        ->assertRedirect();

    expect($ticket->comments()->count())->toBe(1);

    $this->actingAs($this->teacher, 'teacher')
        ->post(route('teacher.help-desk.close', $ticket))
        ->assertRedirect();

    expect($ticket->fresh()->status)->toBe(HelpDeskTicket::STATUS_CLOSED);
});

it('blocks unauthorized admins from viewing help desk', function () {
    $this->actingAs($this->unauthorizedAdmin)
        ->get(route('admin.help-desk.index'))
        ->assertForbidden();
});

it('prevents teachers from viewing other staff tickets', function () {
    $ticket = HelpDeskTicket::create([
        'ticket_number' => 'HD-TEST-0003',
        'subject' => 'Private ticket',
        'description' => 'Only mine',
        'category' => 'other',
        'priority' => 'low',
        'status' => HelpDeskTicket::STATUS_OPEN,
        'created_by' => $this->otherTeacher->id,
    ]);

    $this->actingAs($this->teacher, 'teacher')
        ->get(route('teacher.help-desk.show', $ticket))
        ->assertForbidden();
});
