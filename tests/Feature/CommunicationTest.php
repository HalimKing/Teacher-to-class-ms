<?php

use App\Models\Communication;
use App\Models\CommunicationConversation;
use App\Models\CommunicationRecipient;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\Teacher;
use App\Models\User;
use App\Support\CommunicationPermissions;
use App\Support\LeadershipAssignment;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

function makeCommunicationTeacher(Faculty $faculty, Department $department, array $overrides = []): Teacher
{
    return Teacher::create(array_merge([
        'first_name' => 'Comm',
        'last_name' => 'Staff',
        'email' => 'comm-staff-'.uniqid().'@example.com',
        'phone' => '0244000099',
        'faculty_id' => $faculty->id,
        'department_id' => $department->id,
        'employee_id' => 'COM'.uniqid(),
        'title' => 'Mr.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'password' => 'password',
    ], $overrides));
}

function makeCommunicationAdmin(array $permissions = []): User
{
    $permissions = $permissions === [] ? CommunicationPermissions::all() : $permissions;

    foreach ($permissions as $permission) {
        Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
    }

    app()[PermissionRegistrar::class]->forgetCachedPermissions();

    $role = Role::create(['name' => 'Comm Role '.uniqid(), 'guard_name' => 'web']);
    $role->givePermissionTo($permissions);

    $admin = User::factory()->create([
        'must_change_password' => false,
        'password_changed_at' => now(),
        'email_verified_at' => now(),
        'status' => User::STATUS_ACTIVE,
    ]);
    $admin->assignRole($role);

    return $admin;
}

beforeEach(function () {
    foreach (CommunicationPermissions::all() as $permission) {
        Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
    }
    Permission::firstOrCreate(['name' => 'admin.dashboard.view', 'guard_name' => 'web']);
    app()[PermissionRegistrar::class]->forgetCachedPermissions();

    $this->facultyA = Faculty::create(['name' => 'Comm Faculty A '.uniqid()]);
    $this->facultyB = Faculty::create(['name' => 'Comm Faculty B '.uniqid()]);
    $this->departmentA1 = Department::create([
        'name' => 'Comm Dept A1 '.uniqid(),
        'faculty_id' => $this->facultyA->id,
    ]);
    $this->departmentA2 = Department::create([
        'name' => 'Comm Dept A2 '.uniqid(),
        'faculty_id' => $this->facultyA->id,
    ]);
    $this->departmentB1 = Department::create([
        'name' => 'Comm Dept B1 '.uniqid(),
        'faculty_id' => $this->facultyB->id,
    ]);

    $this->lecturerA1 = makeCommunicationTeacher($this->facultyA, $this->departmentA1, [
        'first_name' => 'Lecturer',
        'last_name' => 'A1',
    ]);
    $this->lecturerA2 = makeCommunicationTeacher($this->facultyA, $this->departmentA2, [
        'first_name' => 'Lecturer',
        'last_name' => 'A2',
    ]);
    $this->lecturerB1 = makeCommunicationTeacher($this->facultyB, $this->departmentB1, [
        'first_name' => 'Lecturer',
        'last_name' => 'B1',
    ]);

    $this->dean = makeCommunicationTeacher($this->facultyA, $this->departmentA1, [
        'first_name' => 'Dean',
        'last_name' => 'Alpha',
        'leadership_role' => LeadershipAssignment::DIRECTOR_DEAN,
        'leadership_faculty_id' => $this->facultyA->id,
    ]);

    $this->hod = makeCommunicationTeacher($this->facultyA, $this->departmentA1, [
        'first_name' => 'Head',
        'last_name' => 'A1',
        'leadership_role' => LeadershipAssignment::HEAD_OF_DEPARTMENT,
        'leadership_faculty_id' => $this->facultyA->id,
        'leadership_department_id' => $this->departmentA1->id,
    ]);

    $this->adminStaffDean = makeCommunicationTeacher($this->facultyA, $this->departmentA1, [
        'first_name' => 'Admin',
        'last_name' => 'Dean',
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
        'leadership_role' => LeadershipAssignment::DIRECTOR_DEAN,
        'leadership_faculty_id' => $this->facultyA->id,
    ]);

    $this->adminStaffHod = makeCommunicationTeacher($this->facultyA, $this->departmentA1, [
        'first_name' => 'Admin',
        'last_name' => 'Hod',
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
        'leadership_role' => LeadershipAssignment::HEAD_OF_DEPARTMENT,
        'leadership_faculty_id' => $this->facultyA->id,
        'leadership_department_id' => $this->departmentA1->id,
    ]);
});

it('blocks ordinary lecturers from composing while still allowing their inbox', function () {
    $this->actingAs($this->lecturerA1, 'teacher')
        ->get(route('teacher.communication.inbox'))
        ->assertOk();

    $this->actingAs($this->lecturerA1, 'teacher')
        ->get(route('teacher.communication.compose'))
        ->assertForbidden();

    $this->actingAs($this->lecturerA1, 'teacher')
        ->post(route('teacher.communication.store'), [
            'subject' => 'Unauthorized',
            'body' => 'Should not send',
            'all_staff' => true,
        ])
        ->assertForbidden();

    $this->actingAs($this->lecturerA1, 'teacher')
        ->get(route('teacher.communication.sent'))
        ->assertOk();

    $this->actingAs($this->lecturerA1, 'teacher')
        ->get(route('teacher.communication.drafts'))
        ->assertOk();

    $this->actingAs($this->lecturerA1, 'teacher')
        ->get(route('teacher.communication.all'))
        ->assertOk();

    $this->actingAs($this->lecturerA1, 'teacher')
        ->get(route('teacher.attendance'))
        ->assertOk();
});

it('lets a lecturer who is director or dean message only staff in their faculty', function () {
    $this->actingAs($this->dean, 'teacher')
        ->get(route('teacher.communication.compose'))
        ->assertOk();

    $this->actingAs($this->dean, 'teacher')
        ->post(route('teacher.communication.store'), [
            'subject' => 'Faculty notice',
            'body' => 'Please submit attendance explanations this week.',
            'all_staff' => true,
        ])
        ->assertRedirect();

    $message = Communication::query()->latest('id')->first();
    expect($message)->not->toBeNull()
        ->and($message->status)->toBe(Communication::STATUS_SENT)
        ->and($message->recipient_count)->toBe(5);

    $recipientIds = $message->recipients()->pluck('teacher_id')->all();
    expect($recipientIds)->toContain($this->lecturerA1->id, $this->lecturerA2->id, $this->hod->id, $this->adminStaffDean->id, $this->adminStaffHod->id)
        ->and($recipientIds)->not->toContain($this->dean->id, $this->lecturerB1->id);

    $this->actingAs($this->dean, 'teacher')
        ->post(route('teacher.communication.store'), [
            'subject' => 'Outside faculty',
            'body' => 'Should fail',
            'staff_ids' => [$this->lecturerB1->id],
        ])
        ->assertForbidden();

    $this->actingAs($this->dean, 'teacher')
        ->get(route('teacher.attendance'))
        ->assertOk();
});

it('lets a lecturer who is head of department message only staff in their department', function () {
    $this->actingAs($this->hod, 'teacher')
        ->post(route('teacher.communication.store'), [
            'subject' => 'Department briefing',
            'body' => 'Department meeting on Monday.',
            'all_staff' => true,
        ])
        ->assertRedirect();

    $message = Communication::query()->latest('id')->first();
    $recipientIds = $message->recipients()->pluck('teacher_id')->all();

    expect($recipientIds)->toContain($this->lecturerA1->id, $this->dean->id, $this->adminStaffDean->id, $this->adminStaffHod->id)
        ->and($recipientIds)->not->toContain($this->hod->id, $this->lecturerA2->id, $this->lecturerB1->id);

    $this->actingAs($this->hod, 'teacher')
        ->post(route('teacher.communication.store'), [
            'subject' => 'Wrong department',
            'body' => 'Should fail',
            'staff_ids' => [$this->lecturerA2->id],
        ])
        ->assertForbidden();
});

it('lets an administrator staff member who is also a dean keep staff attendance and send faculty messages', function () {
    $this->actingAs($this->adminStaffDean, 'teacher')
        ->get(route('teacher.staff-attendance'))
        ->assertOk();

    $this->actingAs($this->adminStaffDean, 'teacher')
        ->post(route('teacher.communication.store'), [
            'subject' => 'Admin dean notice',
            'body' => 'Please update your face enrollment.',
            'staff_ids' => [$this->lecturerA1->id, $this->lecturerA2->id],
        ])
        ->assertRedirect();

    $message = Communication::query()->latest('id')->first();
    expect($message->recipients()->pluck('teacher_id')->all())->toEqualCanonicalizing([
        $this->lecturerA1->id,
        $this->lecturerA2->id,
    ]);
});

it('lets an administrator staff member who is also a head of department keep staff attendance and stay in department scope', function () {
    $this->actingAs($this->adminStaffHod, 'teacher')
        ->get(route('teacher.staff-attendance'))
        ->assertOk();

    $this->actingAs($this->adminStaffHod, 'teacher')
        ->postJson(route('teacher.communication.preview'), [
            'subject' => 'Preview',
            'body' => 'Preview',
            'all_staff' => true,
        ])
        ->assertOk()
        ->assertJsonPath('count', 4);

    $this->actingAs($this->adminStaffHod, 'teacher')
        ->post(route('teacher.communication.store'), [
            'subject' => 'Outside department',
            'body' => 'Should fail',
            'staff_ids' => [$this->lecturerB1->id],
        ])
        ->assertForbidden();
});

it('lets a higher-level administrator send combined faculty, department, and staff audiences without duplicates', function () {
    $admin = makeCommunicationAdmin();

    $this->actingAs($admin, 'web')
        ->get(route('admin.communication.index'))
        ->assertOk();

    $this->actingAs($admin, 'web')
        ->post(route('admin.communication.store'), [
            'subject' => 'Institution notice',
            'body' => 'Campus will close early on Friday.',
            'faculty_ids' => [$this->facultyA->id],
            'department_ids' => [$this->departmentA1->id],
            'staff_ids' => [$this->lecturerA1->id, $this->lecturerB1->id],
        ])
        ->assertRedirect();

    $message = Communication::query()->latest('id')->first();
    $recipientIds = $message->recipients()->pluck('teacher_id')->all();

    expect($message->status)->toBe(Communication::STATUS_SENT)
        ->and($recipientIds)->toContain(
            $this->lecturerA1->id,
            $this->lecturerA2->id,
            $this->dean->id,
            $this->hod->id,
            $this->adminStaffDean->id,
            $this->adminStaffHod->id,
            $this->lecturerB1->id,
        )
        ->and(count($recipientIds))->toBe(count(array_unique($recipientIds)))
        ->and($message->recipient_count)->toBe(count($recipientIds));

    $this->actingAs($this->lecturerA1, 'teacher')
        ->get(route('teacher.communication.show', $message))
        ->assertRedirect(route('teacher.communication.thread', $message->conversation_id));

    $this->actingAs($this->lecturerA1, 'teacher')
        ->get(route('teacher.communication.thread', $message->conversation_id))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('teacher/communication/thread')
            ->where('conversation.subject', 'Institution notice')
            ->where('conversation.messages.0.recipients', [])
        );

    expect(
        CommunicationRecipient::query()
            ->where('communication_id', $message->id)
            ->where('teacher_id', $this->lecturerA1->id)
            ->value('status')
    )->toBe(CommunicationRecipient::STATUS_READ);
});

it('lets a higher-level administrator send to all staff', function () {
    $admin = makeCommunicationAdmin();

    $this->actingAs($admin, 'web')
        ->postJson(route('admin.communication.preview'), [
            'subject' => 'All staff',
            'body' => 'Preview',
            'all_staff' => true,
        ])
        ->assertOk()
        ->assertJsonPath('count', 7);

    $this->actingAs($admin, 'web')
        ->post(route('admin.communication.store'), [
            'subject' => 'All staff memo',
            'body' => 'Please read the updated attendance policy.',
            'all_staff' => true,
        ])
        ->assertRedirect();

    $message = Communication::query()->latest('id')->first();
    expect($message->recipient_count)->toBe(7)
        ->and($message->status)->toBe(Communication::STATUS_SENT);
});

it('prevents administrators from using recipient groups they are not authorized for', function () {
    $limited = makeCommunicationAdmin([
        CommunicationPermissions::VIEW,
        CommunicationPermissions::COMPOSE,
        CommunicationPermissions::SEND,
        CommunicationPermissions::SEND_SELECTED_STAFF,
    ]);

    $this->actingAs($limited, 'web')
        ->post(route('admin.communication.store'), [
            'subject' => 'Unauthorized broadcast',
            'body' => 'Should fail',
            'all_staff' => true,
        ])
        ->assertForbidden();

    $this->actingAs($limited, 'web')
        ->post(route('admin.communication.store'), [
            'subject' => 'Selected staff only',
            'body' => 'Allowed',
            'staff_ids' => [$this->lecturerA1->id],
        ])
        ->assertRedirect();
});

it('blocks unauthorized admins from the communication module', function () {
    $outsider = User::factory()->create([
        'must_change_password' => false,
        'password_changed_at' => now(),
        'email_verified_at' => now(),
        'status' => User::STATUS_ACTIVE,
    ]);

    $this->actingAs($outsider, 'web')
        ->get(route('admin.communication.index'))
        ->assertForbidden();

    $this->actingAs($outsider, 'web')
        ->post(route('admin.communication.store'), [
            'subject' => 'No access',
            'body' => 'Should fail',
            'all_staff' => true,
        ])
        ->assertForbidden();
});

it('prevents teachers from viewing messages they did not send or receive', function () {
    $admin = makeCommunicationAdmin();

    $this->actingAs($admin, 'web')
        ->post(route('admin.communication.store'), [
            'subject' => 'Private to A1',
            'body' => 'Only for lecturer A1',
            'staff_ids' => [$this->lecturerA1->id],
        ])
        ->assertRedirect();

    $message = Communication::query()->latest('id')->first();

    $this->actingAs($this->lecturerB1, 'teacher')
        ->get(route('teacher.communication.show', $message))
        ->assertForbidden();

    $this->actingAs($this->dean, 'teacher')
        ->get(route('teacher.communication.show', $message))
        ->assertForbidden();
});

it('saves drafts without delivering notifications', function () {
    $admin = makeCommunicationAdmin();

    $this->actingAs($admin, 'web')
        ->post(route('admin.communication.store'), [
            'subject' => 'Draft memo',
            'body' => 'Not ready yet',
            'save_as_draft' => true,
            'all_staff' => true,
        ])
        ->assertRedirect(route('admin.communication.drafts'));

    $message = Communication::query()->latest('id')->first();
    expect($message->status)->toBe(Communication::STATUS_DRAFT)
        ->and($message->recipients()->count())->toBe(0)
        ->and($this->lecturerA1->notifications()->count())->toBe(0);
});

it('lets a unit leader send a saved draft from the message page', function () {
    $this->actingAs($this->dean, 'teacher')
        ->post(route('teacher.communication.store'), [
            'subject' => 'Faculty draft',
            'body' => 'This will go out later.',
            'save_as_draft' => true,
            'all_staff' => true,
        ])
        ->assertRedirect(route('teacher.communication.drafts'));

    $message = Communication::query()->latest('id')->first();
    expect($message->status)->toBe(Communication::STATUS_DRAFT)
        ->and($message->conversation_id)->not->toBeNull();

    $this->actingAs($this->dean, 'teacher')
        ->get(route('teacher.communication.show', $message))
        ->assertRedirect(route('teacher.communication.thread', $message->conversation_id));

    $this->actingAs($this->dean, 'teacher')
        ->get(route('teacher.communication.thread', $message->conversation_id))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('conversation.messages.0.status', Communication::STATUS_DRAFT));

    $this->actingAs($this->dean, 'teacher')
        ->post(route('teacher.communication.send', $message))
        ->assertRedirect(route('teacher.communication.thread', $message->conversation_id));

    $message->refresh();
    expect($message->status)->toBe(Communication::STATUS_SENT)
        ->and($message->recipients()->count())->toBeGreaterThan(0)
        ->and($this->lecturerA1->notifications()->count())->toBeGreaterThan(0);
});

it('groups replies into the same conversation and lets ordinary lecturers reply', function () {
    $admin = makeCommunicationAdmin();

    $this->actingAs($admin, 'web')
        ->post(route('admin.communication.store'), [
            'subject' => 'Staff Meeting – September 2026',
            'body' => 'Please confirm your availability.',
            'staff_ids' => [$this->lecturerA1->id, $this->hod->id],
        ])
        ->assertRedirect();

    $original = Communication::query()->latest('id')->first();
    $conversationId = $original->conversation_id;

    expect($conversationId)->not->toBeNull()
        ->and(CommunicationConversation::query()->count())->toBe(1);

    $this->actingAs($this->lecturerA1, 'teacher')
        ->get(route('teacher.communication.inbox'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('teacher/communication/mailbox')
            ->where('folder', 'inbox')
            ->has('conversations.data', 1)
            ->where('conversations.data.0.subject', 'Staff Meeting – September 2026')
            ->where('conversations.data.0.unread', true)
        );

    $this->actingAs($this->lecturerA1, 'teacher')
        ->post(route('teacher.communication.reply', $conversationId), [
            'parent_id' => $original->id,
            'mode' => 'reply',
            'body' => 'I will attend the meeting.',
        ])
        ->assertRedirect(route('teacher.communication.thread', $conversationId));

    expect(Communication::query()->where('conversation_id', $conversationId)->count())->toBe(2)
        ->and(CommunicationConversation::query()->count())->toBe(1);

    $reply = Communication::query()->where('conversation_id', $conversationId)->where('kind', Communication::KIND_REPLY)->first();
    expect($reply)->not->toBeNull()
        ->and($reply->subject)->toBe('Staff Meeting – September 2026')
        ->and($reply->recipients()->where('user_id', $admin->id)->exists())->toBeTrue();

    $this->actingAs($admin, 'web')
        ->get(route('admin.communication.inbox'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('admin/communication/mailbox')
            ->has('conversations.data', 1)
            ->where('conversations.data.0.unread', true)
        );

    $this->actingAs($admin, 'web')
        ->get(route('admin.communication.thread', $conversationId))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('conversation.subject', 'Staff Meeting – September 2026')
            ->has('conversation.messages', 2)
        );
});

it('keeps new messages with the same subject in separate conversations', function () {
    $this->actingAs($this->dean, 'teacher')
        ->post(route('teacher.communication.store'), [
            'subject' => 'Staff Meeting',
            'body' => 'First notice',
            'staff_ids' => [$this->lecturerA1->id],
        ])
        ->assertRedirect();

    $this->actingAs($this->dean, 'teacher')
        ->post(route('teacher.communication.store'), [
            'subject' => 'Staff Meeting',
            'body' => 'Second unrelated notice',
            'staff_ids' => [$this->lecturerA2->id],
        ])
        ->assertRedirect();

    expect(CommunicationConversation::query()->where('subject', 'Staff Meeting')->count())->toBe(2)
        ->and(Communication::query()->where('subject', 'Staff Meeting')->count())->toBe(2);
});

it('sends a reply-all to every conversation participant except the sender', function () {
    $this->actingAs($this->dean, 'teacher')
        ->post(route('teacher.communication.store'), [
            'subject' => 'Faculty briefing',
            'body' => 'Please review the agenda.',
            'staff_ids' => [$this->lecturerA1->id, $this->hod->id],
        ])
        ->assertRedirect();

    $original = Communication::query()->latest('id')->first();

    $this->actingAs($this->lecturerA1, 'teacher')
        ->post(route('teacher.communication.reply', $original->conversation_id), [
            'parent_id' => $original->id,
            'mode' => 'reply_all',
            'body' => 'Agenda received. Copying the rest of the thread.',
        ])
        ->assertRedirect();

    $reply = Communication::query()->where('kind', Communication::KIND_REPLY_ALL)->latest('id')->first();
    $recipientTeacherIds = $reply->recipients()->whereNotNull('teacher_id')->pluck('teacher_id')->all();

    expect($recipientTeacherIds)->toContain($this->dean->id, $this->hod->id)
        ->and($recipientTeacherIds)->not->toContain($this->lecturerA1->id)
        ->and($reply->conversation_id)->toBe($original->conversation_id);
});

it('blocks unauthorized users from opening or replying to a conversation by id', function () {
    $admin = makeCommunicationAdmin();

    $this->actingAs($admin, 'web')
        ->post(route('admin.communication.store'), [
            'subject' => 'Private to A1',
            'body' => 'Confidential',
            'staff_ids' => [$this->lecturerA1->id],
        ])
        ->assertRedirect();

    $conversationId = Communication::query()->latest('id')->value('conversation_id');

    $this->actingAs($this->lecturerB1, 'teacher')
        ->get(route('teacher.communication.thread', $conversationId))
        ->assertForbidden();

    $this->actingAs($this->dean, 'teacher')
        ->get(route('teacher.communication.thread', $conversationId))
        ->assertForbidden();

    $this->actingAs($this->lecturerB1, 'teacher')
        ->post(route('teacher.communication.reply', $conversationId), [
            'parent_id' => Communication::query()->latest('id')->value('id'),
            'mode' => 'reply',
            'body' => 'Should not work',
        ])
        ->assertForbidden();

    $otherAdmin = makeCommunicationAdmin();

    $this->actingAs($otherAdmin, 'web')
        ->get(route('admin.communication.thread', $conversationId))
        ->assertForbidden();
});

it('supports a full compose receive reply continue conversation flow', function () {
    $admin = makeCommunicationAdmin();

    $this->actingAs($admin, 'web')
        ->post(route('admin.communication.store'), [
            'subject' => 'Attendance follow-up',
            'body' => 'Please submit missing records.',
            'staff_ids' => [$this->lecturerA1->id],
        ])
        ->assertRedirect();

    $original = Communication::query()->latest('id')->first();
    $conversationId = $original->conversation_id;

    $this->actingAs($this->lecturerA1, 'teacher')
        ->get(route('teacher.communication.thread', $conversationId))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('conversation.can_reply', true)
            ->has('conversation.messages', 1)
        );

    expect(
        CommunicationRecipient::query()
            ->where('communication_id', $original->id)
            ->where('teacher_id', $this->lecturerA1->id)
            ->value('status')
    )->toBe(CommunicationRecipient::STATUS_READ);

    $this->actingAs($this->lecturerA1, 'teacher')
        ->get(route('teacher.communication.inbox'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('conversations.data.0.unread', false));

    $this->actingAs($this->lecturerA1, 'teacher')
        ->post(route('teacher.communication.reply', $conversationId), [
            'parent_id' => $original->id,
            'mode' => 'reply',
            'body' => 'Records will be submitted tomorrow.',
        ])
        ->assertRedirect(route('teacher.communication.thread', $conversationId));

    $lecturerReply = Communication::query()->where('kind', Communication::KIND_REPLY)->latest('id')->first();

    $this->actingAs($admin, 'web')
        ->post(route('admin.communication.reply', $conversationId), [
            'parent_id' => $lecturerReply->id,
            'mode' => 'reply',
            'body' => 'Thank you. Please use the new template.',
        ])
        ->assertRedirect(route('admin.communication.thread', $conversationId));

    expect(Communication::query()->where('conversation_id', $conversationId)->count())->toBe(3)
        ->and(CommunicationConversation::query()->count())->toBe(1);

    $this->actingAs($this->lecturerA1, 'teacher')
        ->get(route('teacher.communication.inbox', ['search' => 'Attendance follow-up']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('conversations.data', 1)
            ->where('conversations.data.0.subject', 'Attendance follow-up')
            ->where('conversations.data.0.message_count', 3)
        );

    $this->actingAs($this->lecturerA1, 'teacher')
        ->get(route('teacher.communication.inbox', ['search' => 'new template']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('conversations.data', 1));

    $this->actingAs($admin, 'web')
        ->get(route('admin.communication.sent'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('admin/communication/mailbox')
            ->where('folder', 'sent')
            ->has('conversations.data', 1)
        );

    $this->actingAs($this->lecturerA1, 'teacher')
        ->get(route('teacher.communication.sent'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('conversations.data', 1));
});

it('rejects empty replies and replies that point at another conversation', function () {
    $this->actingAs($this->dean, 'teacher')
        ->post(route('teacher.communication.store'), [
            'subject' => 'Valid thread',
            'body' => 'Please reply here.',
            'staff_ids' => [$this->lecturerA1->id],
        ])
        ->assertRedirect();

    $first = Communication::query()->latest('id')->first();

    $this->actingAs($this->dean, 'teacher')
        ->post(route('teacher.communication.store'), [
            'subject' => 'Other thread',
            'body' => 'Unrelated',
            'staff_ids' => [$this->lecturerA2->id],
        ])
        ->assertRedirect();

    $other = Communication::query()->latest('id')->first();

    $this->actingAs($this->lecturerA1, 'teacher')
        ->post(route('teacher.communication.reply', $first->conversation_id), [
            'parent_id' => $first->id,
            'mode' => 'reply',
            'body' => '',
        ])
        ->assertSessionHasErrors('body');

    $this->actingAs($this->lecturerA1, 'teacher')
        ->post(route('teacher.communication.reply', $first->conversation_id), [
            'parent_id' => $other->id,
            'mode' => 'reply',
            'body' => 'Trying to attach this to the wrong thread.',
        ])
        ->assertNotFound();

    expect(Communication::query()->where('conversation_id', $first->conversation_id)->count())->toBe(1);
});

it('lets a sender reply on their own sent conversation and keeps the same thread', function () {
    $this->actingAs($this->dean, 'teacher')
        ->post(route('teacher.communication.store'), [
            'subject' => 'Unit reminder',
            'body' => 'First notice from the dean.',
            'staff_ids' => [$this->lecturerA1->id],
        ])
        ->assertRedirect();

    $original = Communication::query()->latest('id')->first();

    $this->actingAs($this->dean, 'teacher')
        ->get(route('teacher.communication.thread', $original->conversation_id))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('conversation.can_reply', true));

    $this->actingAs($this->dean, 'teacher')
        ->post(route('teacher.communication.reply', $original->conversation_id), [
            'parent_id' => $original->id,
            'mode' => 'reply',
            'body' => 'Adding a follow-up on the same thread.',
        ])
        ->assertRedirect(route('teacher.communication.thread', $original->conversation_id));

    $followUp = Communication::query()->where('kind', Communication::KIND_REPLY)->latest('id')->first();

    expect($followUp->conversation_id)->toBe($original->conversation_id)
        ->and($followUp->recipients()->pluck('teacher_id')->all())->toContain($this->lecturerA1->id);
});
