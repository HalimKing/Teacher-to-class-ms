<?php

use App\Models\ActivityLog;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\Teacher;
use App\Models\User;
use App\Services\ActivityLogService;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

function makeActivityStaff(string $staffType = Teacher::STAFF_TYPE_LECTURER, array $overrides = []): Teacher
{
    $faculty = Faculty::create(['name' => 'Activity Faculty '.uniqid()]);
    $department = Department::create([
        'name' => 'Activity Dept '.uniqid(),
        'faculty_id' => $faculty->id,
    ]);

    return Teacher::create(array_merge([
        'first_name' => 'Activity',
        'last_name' => 'Staff',
        'email' => 'activity-'.uniqid().'@example.com',
        'phone' => '0244111222',
        'faculty_id' => $faculty->id,
        'department_id' => $department->id,
        'employee_id' => 'ACT'.uniqid(),
        'title' => 'Mr.',
        'password' => 'password',
        'staff_type' => $staffType,
    ], $overrides));
}

function writeStaffActivity(Teacher $teacher, string $eventType, string $category, string $description, array $metadata = []): ActivityLog
{
    return ActivityLog::query()->create([
        'event_type' => $eventType,
        'event_category' => $category,
        'description' => $description,
        'status' => ActivityLogService::STATUS_SUCCESS,
        'actor_type' => Teacher::class,
        'actor_id' => $teacher->id,
        'actor_name' => trim("{$teacher->first_name} {$teacher->last_name}"),
        'actor_role' => $teacher->staff_type === Teacher::STAFF_TYPE_ADMINISTRATOR ? 'administrator' : 'teacher',
        'ip_address' => '127.0.0.1',
        'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        'route' => 'teacher/dashboard',
        'method' => 'GET',
        'metadata' => $metadata,
        'is_security_flag' => false,
        'created_at' => now(),
    ]);
}

it('lets a staff member view only their own activities', function () {
    $staff = makeActivityStaff();
    $other = makeActivityStaff(Teacher::STAFF_TYPE_ADMINISTRATOR, ['first_name' => 'Other']);
    $admin = User::factory()->create(['name' => 'System Admin']);

    writeStaffActivity($staff, 'attendance_check_in', 'attendance', 'Attendance check-in recorded');
    writeStaffActivity($other, 'attendance_check_out', 'attendance', 'Other staff checkout');

    ActivityLog::query()->create([
        'event_type' => 'user_created',
        'event_category' => 'user_management',
        'description' => 'Admin created a user',
        'status' => 'success',
        'actor_type' => User::class,
        'actor_id' => $admin->id,
        'actor_name' => $admin->name,
        'actor_role' => 'admin',
        'created_at' => now(),
    ]);

    $this->actingAs($staff, 'teacher')
        ->get('/staff/activities')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('teacher/activities/index')
            ->has('activities.data', 1)
            ->where('activities.data.0.title', 'Checked in for attendance')
            ->where('activities.data.0.module_label', 'Attendance')
            ->where('activities.data.0.ip_address', '127.0.0.1')
            ->where('activities.data.0.browser', 'Chrome')
            ->where('activities.data.0.device', 'Desktop')
        );
});

it('redirects the teacher activities alias to the staff activities page', function () {
    $staff = makeActivityStaff();

    $this->actingAs($staff, 'teacher')
        ->get('/teacher/activities')
        ->assertRedirect(route('staff.activities'));
});

it('blocks guests from the staff activity page', function () {
    $this->get('/staff/activities')->assertRedirect();
});

it('filters activities by module and search', function () {
    $staff = makeActivityStaff();
    writeStaffActivity($staff, 'attendance_check_in', 'attendance', 'Attendance check-in recorded');
    writeStaffActivity($staff, 'login', 'authentication', 'User logged in successfully');

    $this->actingAs($staff, 'teacher')
        ->get('/staff/activities?category=attendance&search=check-in')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('teacher/activities/index')
            ->has('activities.data', 1)
            ->where('activities.data.0.action', 'attendance_check_in')
        );
});

it('filters activities by date range', function () {
    $staff = makeActivityStaff();
    $old = writeStaffActivity($staff, 'login', 'authentication', 'Older login');
    $old->created_at = now()->subDays(10);
    $old->save();
    writeStaffActivity($staff, 'logout', 'authentication', 'Recent logout');

    $this->actingAs($staff, 'teacher')
        ->get('/staff/activities?start_date='.now()->subDay()->toDateString().'&end_date='.now()->toDateString())
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('activities.data', 1)
            ->where('activities.data.0.action', 'logout')
        );
});

it('paginates the staff activity list', function () {
    $staff = makeActivityStaff();

    foreach (range(1, 16) as $index) {
        writeStaffActivity($staff, 'login', 'authentication', "Signed in {$index}");
    }

    $this->actingAs($staff, 'teacher')
        ->get('/staff/activities?per_page=15')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('teacher/activities/index')
            ->has('activities.data', 15)
            ->where('activities.total', 16)
            ->where('activities.last_page', 2)
        );
});

it('shows recent activities on the staff dashboard', function () {
    $staff = makeActivityStaff(Teacher::STAFF_TYPE_ADMINISTRATOR);

    writeStaffActivity($staff, 'attendance_check_out', 'attendance', 'Staff attendance check-out recorded');
    writeStaffActivity($staff, 'login', 'authentication', 'User logged in successfully');

    $this->actingAs($staff, 'teacher')
        ->get('/teacher/dashboard')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('teacher/dashboard')
            ->has('recentActivities', 2)
            ->where('recentActivities.0.title', 'Signed in')
            ->where('recentActivities.1.title', 'Checked out from attendance')
        );
});

it('records a help desk ticket in the staff activity log', function () {
    Notification::fake();
    Permission::firstOrCreate(['name' => 'admin.help-desk.manage', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.help-desk.view', 'guard_name' => 'web']);
    Role::firstOrCreate(['name' => 'Super Admin', 'guard_name' => 'web']);

    $staff = makeActivityStaff();

    $this->actingAs($staff, 'teacher')
        ->post(route('teacher.help-desk.store'), [
            'subject' => 'Cannot mark attendance',
            'description' => 'The check-in button is not responding on mobile.',
            'category' => 'technical',
            'priority' => 'high',
        ])
        ->assertRedirect();

    $log = ActivityLog::query()
        ->forTeacher($staff)
        ->where('event_type', 'help_desk_ticket_created')
        ->first();

    expect($log)->not->toBeNull()
        ->and($log->event_category)->toBe('help_desk')
        ->and($log->description)->toBe('Submitted a help desk ticket')
        ->and($log->metadata['subject'] ?? null)->toBe('Cannot mark attendance');
});

it('records a password change without storing the password', function () {
    $staff = makeActivityStaff();

    $this->actingAs($staff, 'teacher')
        ->from('/settings/password')
        ->put('/settings/password', [
            'current_password' => 'password',
            'password' => 'new-password123',
            'password_confirmation' => 'new-password123',
        ])
        ->assertSessionHasNoErrors();

    $log = ActivityLog::query()
        ->forTeacher($staff)
        ->where('event_type', 'password_changed')
        ->first();

    expect($log)->not->toBeNull()
        ->and($log->event_category)->toBe('account')
        ->and($log->metadata ?? [])->not->toHaveKey('password')
        ->and(json_encode($log->metadata))->not->toContain('new-password123')
        ->and(Hash::check('new-password123', $staff->fresh()->password))->toBeTrue();
});

it('does not expose sensitive metadata on the activities page', function () {
    $staff = makeActivityStaff();
    writeStaffActivity($staff, 'face_verification_failed', 'attendance', 'Face verification failed', [
        'password' => 'secret-pass',
        'face_descriptor' => [1, 2, 3],
        'verification_token' => 'tok_secret',
        'ticket_number' => 'HD-1',
    ]);

    $this->actingAs($staff, 'teacher')
        ->get('/staff/activities')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('activities.data', 1)
            ->where('activities.data.0.resource.label', 'HD-1')
            ->missing('activities.data.0.metadata')
        )
        ->assertDontSee('secret-pass')
        ->assertDontSee('tok_secret');
});
