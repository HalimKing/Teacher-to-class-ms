<?php

use App\Models\AcademicYear;
use App\Models\AttendanceExplanation;
use App\Models\ClassRoom;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\StaffAttendance;
use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Models\TimeTable;
use App\Models\User;
use App\Models\VenueChangeAuthorization;
use App\Models\VenueChangeRequest;
use App\Services\AttendanceExplanationService;
use App\Services\VenueChangeAuthorizationService;
use App\Services\VenueChangeRequestService;
use App\Support\AttendanceExceptionCategory;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Cache::forget('system_settings');

    SystemSetting::query()->updateOrCreate(
        ['key' => 'notify_venue_change_authorized'],
        ['value' => '0', 'group' => 'notifications', 'type' => 'boolean', 'description' => 'test'],
    );
    SystemSetting::query()->updateOrCreate(
        ['key' => 'notify_admin_explanation_submitted'],
        ['value' => '0', 'group' => 'notifications', 'type' => 'boolean', 'description' => 'test'],
    );
    SystemSetting::query()->updateOrCreate(
        ['key' => 'notify_explanation_approved'],
        ['value' => '0', 'group' => 'notifications', 'type' => 'boolean', 'description' => 'test'],
    );
    SystemSetting::query()->updateOrCreate(
        ['key' => 'notify_explanation_rejected'],
        ['value' => '0', 'group' => 'notifications', 'type' => 'boolean', 'description' => 'test'],
    );
    SystemSetting::query()->updateOrCreate(
        ['key' => 'notify_admin_venue_change_request_submitted'],
        ['value' => '0', 'group' => 'notifications', 'type' => 'boolean', 'description' => 'test'],
    );
    SystemSetting::query()->updateOrCreate(
        ['key' => 'notify_venue_change_request_approved'],
        ['value' => '0', 'group' => 'notifications', 'type' => 'boolean', 'description' => 'test'],
    );
    SystemSetting::query()->updateOrCreate(
        ['key' => 'notify_venue_change_request_rejected'],
        ['value' => '0', 'group' => 'notifications', 'type' => 'boolean', 'description' => 'test'],
    );

    $this->faculty = Faculty::create(['name' => 'Venue Faculty']);
    $this->department = Department::create(['name' => 'Venue Dept', 'faculty_id' => $this->faculty->id]);
    $this->academicYear = AcademicYear::create(['name' => '2026/2027', 'status' => 'active']);

    $this->staff = Teacher::create([
        'first_name' => 'Admin',
        'last_name' => 'Staff',
        'email' => 'admin.staff.' . uniqid() . '@example.com',
        'phone' => '1234567890',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'ADM' . uniqid(),
        'title' => 'Mr.',
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
    ]);

    $this->originalVenue = ClassRoom::factory()->create(['name' => 'Original Hall']);
    $this->authorizedVenue = ClassRoom::factory()->create(['name' => 'Authorized Hall']);

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

    Permission::firstOrCreate(['name' => 'admin.venue-change-authorizations.manage', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.venue-change-authorizations.view', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.venue-change-requests.manage', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.venue-change-requests.view', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.attendance-explanations.manage', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.attendance-explanations.view', 'guard_name' => 'web']);

    $role = Role::firstOrCreate(['name' => 'Super Admin', 'guard_name' => 'web']);
    $role->givePermissionTo([
        'admin.venue-change-authorizations.manage',
        'admin.venue-change-authorizations.view',
        'admin.venue-change-requests.manage',
        'admin.venue-change-requests.view',
        'admin.attendance-explanations.manage',
        'admin.attendance-explanations.view',
    ]);

    $this->admin = User::factory()->create([
        'staff_id' => 'ADM' . uniqid(),
        'status' => User::STATUS_ACTIVE,
    ]);
    $this->admin->assignRole($role);
});

it('creates a venue change authorization and resolves the authorized venue', function () {
    $service = app(VenueChangeAuthorizationService::class);

    $authorization = $service->create([
        'staff_id' => $this->staff->id,
        'timetable_id' => $this->timetable->id,
        'original_classroom_id' => $this->originalVenue->id,
        'authorized_classroom_id' => $this->authorizedVenue->id,
        'authorization_type' => VenueChangeAuthorization::TYPE_BOTH,
        'authorization_date' => now()->toDateString(),
        'reason' => 'Room maintenance',
    ], $this->admin);

    expect($authorization->status)->toBe(VenueChangeAuthorization::STATUS_ACTIVE);

    $resolved = $service->resolveEffectiveVenue(
        $this->timetable->fresh('classRoom'),
        (int) $this->staff->id,
        now(),
        'check_in',
    );

    expect($resolved['authorized_venue_used'])->toBeTrue()
        ->and($resolved['classroom']?->id)->toBe($this->authorizedVenue->id)
        ->and($resolved['authorization']?->id)->toBe($authorization->id);
});

it('expires stale venue change authorizations', function () {
    $service = app(VenueChangeAuthorizationService::class);

    $authorization = $service->create([
        'staff_id' => $this->staff->id,
        'original_classroom_id' => $this->originalVenue->id,
        'authorized_classroom_id' => $this->authorizedVenue->id,
        'authorization_type' => VenueChangeAuthorization::TYPE_BOTH,
        'authorization_date' => now()->subDay()->toDateString(),
        'reason' => 'Past authorization',
    ], $this->admin);

    $count = $service->expireStale();

    expect($count)->toBeGreaterThanOrEqual(1)
        ->and($authorization->fresh()->status)->toBe(VenueChangeAuthorization::STATUS_EXPIRED);
});

it('submits and approves an absence explanation as excused absence', function () {
    $attendance = StaffAttendance::create([
        'staff_id' => $this->staff->id,
        'timetable_id' => $this->timetable->id,
        'classroom_id' => $this->originalVenue->id,
        'academic_year_id' => $this->academicYear->id,
        'date' => now()->toDateString(),
        'attendance_status' => 'absent',
        'auto_generated' => true,
        'exception_category' => AttendanceExceptionCategory::UNEXCUSED_ABSENCE,
    ]);

    $service = app(AttendanceExplanationService::class);

    $explanation = $service->submit($this->staff, [
        'attendance_type' => AttendanceExplanation::ATTENDANCE_STAFF,
        'attendance_id' => $attendance->id,
        'timetable_id' => $this->timetable->id,
        'attendance_date' => now()->toDateString(),
        'explanation_type' => AttendanceExplanation::TYPE_ABSENCE,
        'reason_category' => 'sick_leave',
        'explanation' => 'Medical appointment with supporting documents pending.',
    ]);

    expect($explanation->status)->toBe(AttendanceExplanation::STATUS_PENDING);

    $service->approve($explanation, $this->admin, 'Approved with medical note', true);

    $attendance->refresh();
    $explanation->refresh();

    expect($explanation->status)->toBe(AttendanceExplanation::STATUS_APPROVED)
        ->and($attendance->attendance_status)->toBe('excused_absence')
        ->and($attendance->exception_category)->toBe(AttendanceExceptionCategory::EXCUSED_ABSENCE);
});

it('allows admin to create venue change authorization via HTTP', function () {
    $this->actingAs($this->admin)
        ->post(route('admin.venue-change-authorizations.store'), [
            'staff_id' => $this->staff->id,
            'timetable_ids' => [$this->timetable->id],
            'authorized_classroom_id' => $this->authorizedVenue->id,
            'authorization_type' => VenueChangeAuthorization::TYPE_BOTH,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(3)->toDateString(),
            'reason' => 'Hall booked for event',
            'notes' => 'Temporary relocation',
        ])
        ->assertRedirect(route('admin.venue-change-authorizations.index'));

    $this->assertDatabaseHas('venue_change_authorizations', [
        'staff_id' => $this->staff->id,
        'timetable_id' => $this->timetable->id,
        'authorized_classroom_id' => $this->authorizedVenue->id,
        'status' => VenueChangeAuthorization::STATUS_ACTIVE,
    ]);

    $created = VenueChangeAuthorization::query()
        ->where('staff_id', $this->staff->id)
        ->where('timetable_id', $this->timetable->id)
        ->latest('id')
        ->first();

    expect($created?->start_date?->toDateString())->toBe(now()->toDateString())
        ->and($created?->end_date?->toDateString())->toBe(now()->addDays(3)->toDateString());
});
it('creates bulk venue change authorizations under one group id', function () {
    $secondVenue = ClassRoom::factory()->create(['name' => 'Second Original']);
    $secondTimetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'teacher_id' => $this->staff->id,
        'class_room_id' => $secondVenue->id,
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
        'day' => Carbon::now()->format('l'),
        'day_of_week' => Carbon::now()->format('l'),
        'start_time' => '09:00:00',
        'end_time' => '12:00:00',
    ]);

    $service = app(VenueChangeAuthorizationService::class);

    $created = $service->createBulk([
        'staff_id' => $this->staff->id,
        'authorized_classroom_id' => $this->authorizedVenue->id,
        'authorization_type' => VenueChangeAuthorization::TYPE_BOTH,
        'start_date' => now()->toDateString(),
        'end_date' => now()->addDays(2)->toDateString(),
        'reason' => 'Campus event',
        'notes' => 'Shared notes',
    ], [$this->timetable->id, $secondTimetable->id], $this->admin);

    expect($created)->toHaveCount(2)
        ->and($created->pluck('bulk_group_id')->unique()->filter()->count())->toBe(1)
        ->and($created->pluck('timetable_id')->sort()->values()->all())->toBe([
            $this->timetable->id,
            $secondTimetable->id,
        ]);

    $resolvedFirst = $service->resolveEffectiveVenue($this->timetable->fresh('classRoom'), (int) $this->staff->id, now(), 'check_in');
    $resolvedSecond = $service->resolveEffectiveVenue($secondTimetable->fresh('classRoom'), (int) $this->staff->id, now()->addDay(), 'check_out');

    expect($resolvedFirst['authorized_venue_used'])->toBeTrue()
        ->and($resolvedSecond['authorized_venue_used'])->toBeTrue()
        ->and($resolvedFirst['classroom']?->id)->toBe($this->authorizedVenue->id)
        ->and($resolvedSecond['classroom']?->id)->toBe($this->authorizedVenue->id);
});

it('rejects conflicting bulk venue authorizations for the same schedules', function () {
    $service = app(VenueChangeAuthorizationService::class);

    $service->createBulk([
        'staff_id' => $this->staff->id,
        'authorized_classroom_id' => $this->authorizedVenue->id,
        'authorization_type' => VenueChangeAuthorization::TYPE_CHECK_IN,
        'start_date' => now()->toDateString(),
        'end_date' => now()->addDays(5)->toDateString(),
        'reason' => 'First authorization',
    ], [$this->timetable->id], $this->admin);

    expect(fn () => $service->createBulk([
        'staff_id' => $this->staff->id,
        'authorized_classroom_id' => $this->authorizedVenue->id,
        'authorization_type' => VenueChangeAuthorization::TYPE_BOTH,
        'start_date' => now()->addDays(3)->toDateString(),
        'end_date' => now()->addDays(7)->toDateString(),
        'reason' => 'Duplicate authorization',
    ], [$this->timetable->id], $this->admin))->toThrow(\InvalidArgumentException::class);
});

it('applies venue authorization across a multi-day period', function () {
    $service = app(VenueChangeAuthorizationService::class);

    $authorization = $service->create([
        'staff_id' => $this->staff->id,
        'timetable_id' => $this->timetable->id,
        'original_classroom_id' => $this->originalVenue->id,
        'authorized_classroom_id' => $this->authorizedVenue->id,
        'authorization_type' => VenueChangeAuthorization::TYPE_BOTH,
        'start_date' => now()->toDateString(),
        'end_date' => now()->addDays(4)->toDateString(),
        'reason' => 'Week-long relocation',
    ], $this->admin);

    expect($authorization->period_label)->toContain('–');

    $midPeriod = $service->resolveEffectiveVenue(
        $this->timetable->fresh('classRoom'),
        (int) $this->staff->id,
        now()->addDays(2),
        'check_in',
    );

    $afterPeriod = $service->resolveEffectiveVenue(
        $this->timetable->fresh('classRoom'),
        (int) $this->staff->id,
        now()->addDays(5),
        'check_in',
    );

    expect($midPeriod['authorized_venue_used'])->toBeTrue()
        ->and($afterPeriod['authorized_venue_used'])->toBeFalse();
});

it('lets administrator staff submit a venue change request that stays pending', function () {
    $service = app(VenueChangeRequestService::class);

    $request = $service->submit($this->staff, [
        'authorized_classroom_id' => $this->authorizedVenue->id,
        'authorization_type' => VenueChangeRequest::TYPE_BOTH,
        'start_date' => now()->toDateString(),
        'end_date' => now()->addDays(2)->toDateString(),
        'reason' => 'Temporary office relocation',
        'notes' => 'Need closer venue',
    ], [$this->timetable->id]);

    expect($request->status)->toBe(VenueChangeRequest::STATUS_PENDING)
        ->and($request->status_label)->toBe('Pending approval')
        ->and($request->items)->toHaveCount(1);

    $this->assertDatabaseMissing('venue_change_authorizations', [
        'source_request_id' => $request->id,
    ]);
});

it('approves a venue change request into an active authorization', function () {
    $service = app(VenueChangeRequestService::class);

    $request = $service->submit($this->staff, [
        'authorized_classroom_id' => $this->authorizedVenue->id,
        'authorization_type' => VenueChangeRequest::TYPE_BOTH,
        'start_date' => now()->toDateString(),
        'end_date' => now()->addDay()->toDateString(),
        'reason' => 'Meeting room unavailable',
    ], [$this->timetable->id]);

    $approved = $service->approve($request, $this->admin, 'Approved for event week');

    expect($approved->status)->toBe(VenueChangeRequest::STATUS_APPROVED)
        ->and($approved->status_label)->toBe('Approved authorization')
        ->and($approved->resulting_authorization_id)->not->toBeNull()
        ->and($approved->reviewed_by)->toBe($this->admin->id);

    $authorization = VenueChangeAuthorization::query()->find($approved->resulting_authorization_id);

    expect($authorization)->not->toBeNull()
        ->and($authorization->status)->toBe(VenueChangeAuthorization::STATUS_ACTIVE)
        ->and($authorization->source_request_id)->toBe($request->id)
        ->and($authorization->authorized_classroom_id)->toBe($this->authorizedVenue->id);

    $resolved = app(VenueChangeAuthorizationService::class)->resolveEffectiveVenue(
        $this->timetable->fresh('classRoom'),
        (int) $this->staff->id,
        now(),
        'check_in',
    );

    expect($resolved['authorized_venue_used'])->toBeTrue()
        ->and($resolved['classroom']?->id)->toBe($this->authorizedVenue->id);
});

it('rejects a venue change request without creating an authorization', function () {
    $service = app(VenueChangeRequestService::class);

    $request = $service->submit($this->staff, [
        'authorized_classroom_id' => $this->authorizedVenue->id,
        'authorization_type' => VenueChangeRequest::TYPE_CHECK_IN,
        'start_date' => now()->toDateString(),
        'end_date' => now()->toDateString(),
        'reason' => 'Prefer alternate hall',
    ], [$this->timetable->id]);

    $rejected = $service->reject($request, $this->admin, 'Insufficient justification');

    expect($rejected->status)->toBe(VenueChangeRequest::STATUS_REJECTED)
        ->and($rejected->status_label)->toBe('Rejected request')
        ->and($rejected->admin_comments)->toBe('Insufficient justification');

    $this->assertDatabaseMissing('venue_change_authorizations', [
        'source_request_id' => $request->id,
    ]);
});

it('allows admin to approve a venue change request via HTTP while keeping direct authorize intact', function () {
    $service = app(VenueChangeRequestService::class);

    $request = $service->submit($this->staff, [
        'authorized_classroom_id' => $this->authorizedVenue->id,
        'authorization_type' => VenueChangeRequest::TYPE_BOTH,
        'start_date' => now()->addDays(10)->toDateString(),
        'end_date' => now()->addDays(12)->toDateString(),
        'reason' => 'HTTP approval path',
    ], [$this->timetable->id]);

    $this->actingAs($this->admin)
        ->post(route('admin.venue-change-requests.approve', $request), [
            'admin_comments' => 'Looks good',
        ])
        ->assertRedirect(route('admin.venue-change-requests.show', $request));

    expect($request->fresh()->status)->toBe(VenueChangeRequest::STATUS_APPROVED);

    // Direct authorization path remains available.
    $otherVenue = ClassRoom::factory()->create(['name' => 'Direct Auth Hall']);
    $this->actingAs($this->admin)
        ->post(route('admin.venue-change-authorizations.store'), [
            'staff_id' => $this->staff->id,
            'timetable_ids' => [$this->timetable->id],
            'authorized_classroom_id' => $otherVenue->id,
            'authorization_type' => VenueChangeAuthorization::TYPE_BOTH,
            'start_date' => now()->addDays(20)->toDateString(),
            'end_date' => now()->addDays(21)->toDateString(),
            'reason' => 'Direct authorize still works',
        ])
        ->assertRedirect(route('admin.venue-change-authorizations.index'));
});

it('blocks new venue change request submissions when the feature setting is disabled', function () {
    SystemSetting::query()->updateOrCreate(
        ['key' => 'administrator_venue_change_requests_enabled'],
        [
            'value' => '0',
            'group' => 'attendance',
            'type' => 'boolean',
            'description' => 'test',
        ],
    );
    SystemSetting::clearCache();

    expect(SystemSetting::administratorVenueChangeRequestsEnabled())->toBeFalse();

    expect(fn () => app(VenueChangeRequestService::class)->submit($this->staff, [
        'authorized_classroom_id' => $this->authorizedVenue->id,
        'authorization_type' => VenueChangeRequest::TYPE_BOTH,
        'start_date' => now()->toDateString(),
        'end_date' => now()->toDateString(),
        'reason' => 'Should be blocked',
    ], [$this->timetable->id]))->toThrow(\InvalidArgumentException::class);

    // Existing authorizations still resolve after the setting is off.
    $authService = app(VenueChangeAuthorizationService::class);
    $authorization = $authService->create([
        'staff_id' => $this->staff->id,
        'timetable_id' => $this->timetable->id,
        'original_classroom_id' => $this->originalVenue->id,
        'authorized_classroom_id' => $this->authorizedVenue->id,
        'authorization_type' => VenueChangeAuthorization::TYPE_BOTH,
        'start_date' => now()->toDateString(),
        'end_date' => now()->toDateString(),
        'reason' => 'Direct auth unaffected',
    ], $this->admin);

    $resolved = $authService->resolveEffectiveVenue(
        $this->timetable->fresh('classRoom'),
        (int) $this->staff->id,
        now(),
        'check_in',
    );

    expect($authorization->status)->toBe(VenueChangeAuthorization::STATUS_ACTIVE)
        ->and($resolved['authorized_venue_used'])->toBeTrue();
});

it('audits previous and new values when the venue change request setting is toggled', function () {
    SystemSetting::query()->updateOrCreate(
        ['key' => 'administrator_venue_change_requests_enabled'],
        [
            'value' => '1',
            'group' => 'attendance',
            'type' => 'boolean',
            'description' => 'test',
        ],
    );
    SystemSetting::clearCache();

    Permission::firstOrCreate(['name' => 'admin.settings.edit', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.settings.view', 'guard_name' => 'web']);
    $this->admin->givePermissionTo(['admin.settings.edit', 'admin.settings.view']);

    $this->actingAs($this->admin)
        ->put(route('admin.settings-reports.settings.update'), [
            'group' => 'attendance',
            'settings' => [
                'administrator_venue_change_requests_enabled' => false,
            ],
        ])
        ->assertRedirect(route('admin.settings-reports.settings.index'));

    expect(SystemSetting::administratorVenueChangeRequestsEnabled())->toBeFalse();

    $this->assertDatabaseHas('activity_logs', [
        'event_type' => 'setting_changed',
        'event_category' => 'system_settings',
    ]);

    $log = \App\Models\ActivityLog::query()
        ->where('event_type', 'setting_changed')
        ->latest('id')
        ->first();

    expect($log)->not->toBeNull()
        ->and($log->metadata['setting_key'] ?? null)->toBe('administrator_venue_change_requests_enabled')
        ->and($log->metadata['previous_value'] ?? null)->toBeTrue()
        ->and($log->metadata['new_value'] ?? null)->toBeFalse()
        ->and($log->metadata['changed_by'] ?? null)->toBe($this->admin->id)
        ->and($log->metadata['changed_at'] ?? null)->not->toBeNull();
});
