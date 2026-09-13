<?php

use App\Models\AcademicYear;
use App\Models\ClassRoom;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Models\TimeTable;
use App\Models\User;
use App\Models\VenueChangeAuthorization;
use App\Models\VenueChangeRequest;
use App\Models\VenueChangeRequestApproval;
use App\Notifications\LeadershipVenueChangeRequestSubmitted;
use App\Services\VenueChangeRequestService;
use App\Support\LeadershipAssignment;
use App\Support\VenueChangeApprovalRole;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Cache::forget('system_settings');
    Notification::fake();

    SystemSetting::query()->updateOrCreate(
        ['key' => 'administrator_venue_change_requests_enabled'],
        ['value' => '1', 'group' => 'attendance', 'type' => 'boolean', 'description' => 'test'],
    );
    SystemSetting::query()->updateOrCreate(
        ['key' => 'notify_admin_venue_change_request_submitted'],
        ['value' => '0', 'group' => 'notifications', 'type' => 'boolean', 'description' => 'test'],
    );
    SystemSetting::query()->updateOrCreate(
        ['key' => 'notify_leadership_venue_change_request_submitted'],
        ['value' => '1', 'group' => 'notifications', 'type' => 'boolean', 'description' => 'test'],
    );
    SystemSetting::query()->updateOrCreate(
        ['key' => 'notify_venue_change_request_approved'],
        ['value' => '0', 'group' => 'notifications', 'type' => 'boolean', 'description' => 'test'],
    );
    SystemSetting::query()->updateOrCreate(
        ['key' => 'notify_venue_change_request_rejected'],
        ['value' => '0', 'group' => 'notifications', 'type' => 'boolean', 'description' => 'test'],
    );
    SystemSetting::query()->updateOrCreate(
        ['key' => 'notify_venue_change_authorized'],
        ['value' => '0', 'group' => 'notifications', 'type' => 'boolean', 'description' => 'test'],
    );
    SystemSetting::clearCache();

    $this->faculty = Faculty::create(['name' => 'Venue Leadership Faculty']);
    $this->otherFaculty = Faculty::create(['name' => 'Other Venue Faculty']);
    $this->department = Department::create(['name' => 'Venue Leadership Dept', 'faculty_id' => $this->faculty->id]);
    $this->otherDepartment = Department::create(['name' => 'Other Venue Dept', 'faculty_id' => $this->otherFaculty->id]);
    $this->academicYear = AcademicYear::create(['name' => '2026/2027 Venue Leadership', 'status' => 'active']);

    $this->staff = Teacher::create([
        'first_name' => 'Admin',
        'last_name' => 'Requester',
        'email' => 'venue-staff-'.uniqid().'@example.com',
        'phone' => '1234567890',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'VCR'.uniqid(),
        'title' => 'Mr.',
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
        'password' => 'password',
    ]);

    $this->lecturer = Teacher::create([
        'first_name' => 'No',
        'last_name' => 'Authority',
        'email' => 'venue-lecturer-'.uniqid().'@example.com',
        'phone' => '1234567891',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'VCL'.uniqid(),
        'title' => 'Dr.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'password' => 'password',
    ]);

    $this->dean = Teacher::create([
        'first_name' => 'Efua',
        'last_name' => 'Dean',
        'email' => 'venue-dean-'.uniqid().'@example.com',
        'phone' => '1234567892',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'VCD'.uniqid(),
        'title' => 'Prof.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'leadership_role' => LeadershipAssignment::DIRECTOR_DEAN,
        'leadership_faculty_id' => $this->faculty->id,
        'password' => 'password',
    ]);

    $this->hod = Teacher::create([
        'first_name' => 'Yaw',
        'last_name' => 'Head',
        'email' => 'venue-hod-'.uniqid().'@example.com',
        'phone' => '1234567893',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'VCH'.uniqid(),
        'title' => 'Dr.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'leadership_role' => LeadershipAssignment::HEAD_OF_DEPARTMENT,
        'leadership_faculty_id' => $this->faculty->id,
        'leadership_department_id' => $this->department->id,
        'password' => 'password',
    ]);

    $this->otherDean = Teacher::create([
        'first_name' => 'Outside',
        'last_name' => 'Dean',
        'email' => 'venue-other-dean-'.uniqid().'@example.com',
        'phone' => '1234567894',
        'faculty_id' => $this->otherFaculty->id,
        'department_id' => $this->otherDepartment->id,
        'employee_id' => 'VCO'.uniqid(),
        'title' => 'Prof.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'leadership_role' => LeadershipAssignment::DIRECTOR_DEAN,
        'leadership_faculty_id' => $this->otherFaculty->id,
        'password' => 'password',
    ]);

    $this->originalVenue = ClassRoom::factory()->create(['name' => 'Original Leadership Hall']);
    $this->authorizedVenue = ClassRoom::factory()->create(['name' => 'Requested Leadership Hall']);

    $this->timetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'teacher_id' => $this->staff->id,
        'class_room_id' => $this->originalVenue->id,
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
        'day' => Carbon::now()->format('l'),
        'day_of_week' => Carbon::now()->format('l'),
        'start_time' => '08:00:00',
        'end_time' => '17:00:00',
    ]);

    Permission::firstOrCreate(['name' => 'admin.venue-change-requests.manage', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.venue-change-requests.view', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.venue-change-authorizations.manage', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.venue-change-authorizations.view', 'guard_name' => 'web']);

    $role = Role::firstOrCreate(['name' => 'Super Admin', 'guard_name' => 'web']);
    $role->givePermissionTo([
        'admin.venue-change-requests.manage',
        'admin.venue-change-requests.view',
        'admin.venue-change-authorizations.manage',
        'admin.venue-change-authorizations.view',
    ]);

    $this->admin = User::factory()->create([
        'staff_id' => 'ADM'.uniqid(),
        'status' => User::STATUS_ACTIVE,
    ]);
    $this->admin->assignRole($role);
});

function submitLeadershipVenueRequest(): VenueChangeRequest
{
    return app(VenueChangeRequestService::class)->submit(test()->staff, [
        'authorized_classroom_id' => test()->authorizedVenue->id,
        'authorization_type' => VenueChangeRequest::TYPE_BOTH,
        'start_date' => now()->toDateString(),
        'end_date' => now()->addDay()->toDateString(),
        'reason' => 'Leadership routing test',
    ], [test()->timetable->id]);
}

it('routes a submitted venue change request to the dean, hod, and administrator', function () {
    $request = submitLeadershipVenueRequest();

    expect($request->approvals)->toHaveCount(3)
        ->and($request->approvals->pluck('role')->sort()->values()->all())->toBe([
            VenueChangeApprovalRole::ADMINISTRATOR,
            VenueChangeApprovalRole::DIRECTOR_DEAN,
            VenueChangeApprovalRole::HEAD_OF_DEPARTMENT,
        ])
        ->and($request->status)->toBe(VenueChangeRequest::STATUS_PENDING);

    Notification::assertSentTo($this->dean, LeadershipVenueChangeRequestSubmitted::class);
    Notification::assertSentTo($this->hod, LeadershipVenueChangeRequestSubmitted::class);
    Notification::assertNotSentTo($this->otherDean, LeadershipVenueChangeRequestSubmitted::class);
    Notification::assertNotSentTo($this->staff, LeadershipVenueChangeRequestSubmitted::class);
});

it('keeps the request pending until dean, hod, and administrator have all approved', function () {
    $service = app(VenueChangeRequestService::class);
    $request = submitLeadershipVenueRequest();

    $afterAdmin = $service->approve($request, $this->admin, 'Admin approved');
    expect($afterAdmin->status)->toBe(VenueChangeRequest::STATUS_PENDING);
    $this->assertDatabaseMissing('venue_change_authorizations', ['source_request_id' => $request->id]);

    $afterDean = $service->recordLeadershipDecision($afterAdmin, $this->dean, true, 'Dean approved');
    expect($afterDean->status)->toBe(VenueChangeRequest::STATUS_PENDING);
    $this->assertDatabaseMissing('venue_change_authorizations', ['source_request_id' => $request->id]);

    $afterHod = $service->recordLeadershipDecision($afterDean, $this->hod, true, 'HoD approved');
    expect($afterHod->status)->toBe(VenueChangeRequest::STATUS_APPROVED)
        ->and($afterHod->resulting_authorization_id)->not->toBeNull();

    $authorization = VenueChangeAuthorization::query()->find($afterHod->resulting_authorization_id);
    expect($authorization)->not->toBeNull()
        ->and($authorization->status)->toBe(VenueChangeAuthorization::STATUS_ACTIVE);
});

it('rejects the overall request when any required approver rejects it', function () {
    $service = app(VenueChangeRequestService::class);
    $request = submitLeadershipVenueRequest();

    $service->approve($request, $this->admin, 'Admin approved');
    $rejected = $service->recordLeadershipDecision($request->fresh(), $this->dean, false, 'Venue is not available');

    expect($rejected->status)->toBe(VenueChangeRequest::STATUS_REJECTED)
        ->and($rejected->admin_comments)->toBe('Venue is not available');

    $this->assertDatabaseMissing('venue_change_authorizations', ['source_request_id' => $request->id]);

    expect(fn () => $service->recordLeadershipDecision($rejected->fresh(), $this->hod, true, 'Too late'))
        ->toThrow(InvalidArgumentException::class);
});

it('prevents duplicate approvals and out-of-scope leadership decisions', function () {
    $service = app(VenueChangeRequestService::class);
    $request = submitLeadershipVenueRequest();

    $service->recordLeadershipDecision($request, $this->dean, true, 'Dean approved');

    expect(fn () => $service->recordLeadershipDecision($request->fresh(), $this->dean, true, 'Again'))
        ->toThrow(InvalidArgumentException::class);

    expect(fn () => $service->recordLeadershipDecision($request->fresh(), $this->otherDean, true, 'Wrong faculty'))
        ->toThrow(InvalidArgumentException::class);

    expect(fn () => $service->recordLeadershipDecision($request->fresh(), $this->lecturer, true, 'No leadership'))
        ->toThrow(InvalidArgumentException::class);
});

it('lets authorized leaders review and act through HTTP while blocking unauthorized users', function () {
    $request = submitLeadershipVenueRequest();

    $this->actingAs($this->dean, 'teacher')
        ->get(route('teacher.unit.venue-change-requests.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('teacher/unit/venue-change-requests')
            ->has('requests.data', 1));

    $this->actingAs($this->hod, 'teacher')
        ->get(route('teacher.unit.venue-change-requests.show', $request))
        ->assertOk();

    $this->actingAs($this->otherDean, 'teacher')
        ->get(route('teacher.unit.venue-change-requests.show', $request))
        ->assertForbidden();

    $this->actingAs($this->lecturer, 'teacher')
        ->get(route('teacher.unit.venue-change-requests.index'))
        ->assertForbidden();

    $this->actingAs($this->lecturer, 'teacher')
        ->post(route('teacher.unit.venue-change-requests.approve', $request))
        ->assertForbidden();

    $this->actingAs($this->otherDean, 'teacher')
        ->post(route('teacher.unit.venue-change-requests.approve', $request), [
            'comments' => 'Out of scope',
        ])
        ->assertForbidden();

    $this->actingAs($this->dean, 'teacher')
        ->post(route('teacher.unit.venue-change-requests.approve', $request), [
            'comments' => 'Dean HTTP approval',
        ])
        ->assertRedirect(route('teacher.unit.venue-change-requests.show', $request));

    expect($request->fresh()->status)->toBe(VenueChangeRequest::STATUS_PENDING)
        ->and($request->fresh()->approvals->firstWhere('role', VenueChangeApprovalRole::DIRECTOR_DEAN)?->status)
        ->toBe(VenueChangeRequestApproval::STATUS_APPROVED);
});

it('lets the administrator approve through the existing HTTP path without finalizing early', function () {
    $request = submitLeadershipVenueRequest();

    $this->actingAs($this->admin)
        ->post(route('admin.venue-change-requests.approve', $request), [
            'admin_comments' => 'Looks good so far',
        ])
        ->assertRedirect(route('admin.venue-change-requests.show', $request));

    expect($request->fresh()->status)->toBe(VenueChangeRequest::STATUS_PENDING);
    $this->assertDatabaseMissing('venue_change_authorizations', ['source_request_id' => $request->id]);

    $this->actingAs($this->admin)
        ->post(route('admin.venue-change-requests.approve', $request), [
            'admin_comments' => 'Duplicate',
        ])
        ->assertRedirect()
        ->assertSessionHas('error');
});

it('blocks lecturers from submitting venue change requests and keeps administrator submission working', function () {
    expect(fn () => app(VenueChangeRequestService::class)->submit($this->lecturer, [
        'authorized_classroom_id' => $this->authorizedVenue->id,
        'authorization_type' => VenueChangeRequest::TYPE_BOTH,
        'start_date' => now()->toDateString(),
        'end_date' => now()->toDateString(),
        'reason' => 'Lecturer should not submit',
    ], [$this->timetable->id]))->toThrow(InvalidArgumentException::class);

    $this->actingAs($this->staff, 'teacher')
        ->post(route('teacher.venue-change-requests.store'), [
            'timetable_ids' => [$this->timetable->id],
            'authorized_classroom_id' => $this->authorizedVenue->id,
            'authorization_type' => VenueChangeRequest::TYPE_BOTH,
            'start_date' => now()->addDays(4)->toDateString(),
            'end_date' => now()->addDays(5)->toDateString(),
            'reason' => 'Administrator HTTP submission',
        ])
        ->assertRedirect(route('teacher.venue-change-requests.index'));

    expect(VenueChangeRequest::query()->where('staff_id', $this->staff->id)->count())->toBe(1);
});

it('lets deans and heads of department view unit venue change authorizations', function () {
    $service = app(VenueChangeRequestService::class);
    $request = submitLeadershipVenueRequest();
    $service->approve($request, $this->admin, 'Admin approved');
    $service->recordLeadershipDecision($request->fresh(), $this->dean, true, 'Dean approved');
    $approved = $service->recordLeadershipDecision($request->fresh(), $this->hod, true, 'HoD approved');
    $authorizationId = $approved->resulting_authorization_id;

    expect($authorizationId)->not->toBeNull();

    $this->actingAs($this->dean, 'teacher')
        ->get(route('teacher.unit.venue-change-authorizations.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('teacher/unit/venue-change-authorizations')
            ->has('authorizations.data', 1));

    $this->actingAs($this->hod, 'teacher')
        ->get(route('teacher.unit.venue-change-authorizations.show', $authorizationId))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('teacher/unit/venue-change-authorization-show')
            ->where('authorization.id', $authorizationId));

    $this->actingAs($this->otherDean, 'teacher')
        ->get(route('teacher.unit.venue-change-authorizations.show', $authorizationId))
        ->assertForbidden();

    $this->actingAs($this->lecturer, 'teacher')
        ->get(route('teacher.unit.venue-change-authorizations.index'))
        ->assertForbidden();
});

it('lets a dean create a venue change authorization for staff in their unit', function () {
    $this->actingAs($this->dean, 'teacher')
        ->get(route('teacher.unit.venue-change-authorizations.create'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('teacher/unit/venue-change-authorization-create')
            ->has('staffMembers', 1)
            ->where('staffMembers.0.id', $this->staff->id));

    $this->actingAs($this->dean, 'teacher')
        ->post(route('teacher.unit.venue-change-authorizations.store'), [
            'staff_id' => $this->staff->id,
            'timetable_ids' => [$this->timetable->id],
            'authorized_classroom_id' => $this->authorizedVenue->id,
            'authorization_type' => VenueChangeAuthorization::TYPE_BOTH,
            'start_date' => now()->addDays(6)->toDateString(),
            'end_date' => now()->addDays(7)->toDateString(),
            'reason' => 'Leadership created authorization',
        ])
        ->assertRedirect(route('teacher.unit.venue-change-authorizations.index'));

    $authorization = VenueChangeAuthorization::query()
        ->where('staff_id', $this->staff->id)
        ->where('reason', 'Leadership created authorization')
        ->first();

    expect($authorization)->not->toBeNull()
        ->and($authorization->status)->toBe(VenueChangeAuthorization::STATUS_ACTIVE)
        ->and($authorization->approved_by_teacher_id)->toBe($this->dean->id)
        ->and($authorization->approved_by)->toBeNull();
});

it('blocks out-of-scope leadership from creating venue change authorizations', function () {
    $this->actingAs($this->otherDean, 'teacher')
        ->post(route('teacher.unit.venue-change-authorizations.store'), [
            'staff_id' => $this->staff->id,
            'timetable_ids' => [$this->timetable->id],
            'authorized_classroom_id' => $this->authorizedVenue->id,
            'authorization_type' => VenueChangeAuthorization::TYPE_BOTH,
            'start_date' => now()->addDays(8)->toDateString(),
            'end_date' => now()->addDays(9)->toDateString(),
            'reason' => 'Out of scope create',
        ])
        ->assertForbidden();

    $this->actingAs($this->lecturer, 'teacher')
        ->get(route('teacher.unit.venue-change-authorizations.create'))
        ->assertForbidden();

    $this->actingAs($this->otherDean, 'teacher')
        ->get(route('teacher.unit.venue-change-authorizations.staff-schedules', $this->staff))
        ->assertForbidden();
});
