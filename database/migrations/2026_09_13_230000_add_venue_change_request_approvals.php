<?php

use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Models\VenueChangeRequest;
use App\Models\VenueChangeRequestApproval;
use App\Support\VenueChangeApprovalRole;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('venue_change_requests', function (Blueprint $table) {
            $table->foreignId('faculty_id')
                ->nullable()
                ->after('staff_id')
                ->constrained('faculties')
                ->nullOnDelete();
            $table->foreignId('department_id')
                ->nullable()
                ->after('faculty_id')
                ->constrained('departments')
                ->nullOnDelete();
        });

        Schema::create('venue_change_request_approvals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('venue_change_request_id')
                ->constrained('venue_change_requests')
                ->cascadeOnDelete();
            $table->string('role', 32);
            $table->string('status', 32)->default(VenueChangeRequestApproval::STATUS_PENDING);
            $table->foreignId('assigned_teacher_id')
                ->nullable()
                ->constrained('teachers')
                ->nullOnDelete();
            $table->nullableMorphs('decided_by');
            $table->text('comments')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();

            $table->unique(['venue_change_request_id', 'role'], 'vcr_approval_role_unique');
            $table->index(['role', 'status'], 'vcr_approval_role_status_idx');
        });

        VenueChangeRequest::query()
            ->with('staff')
            ->each(function (VenueChangeRequest $request) {
                $staff = $request->staff;

                if ($staff instanceof Teacher) {
                    $request->forceFill([
                        'faculty_id' => $staff->faculty_id,
                        'department_id' => $staff->department_id,
                    ])->save();
                }

                if ($request->approvals()->exists()) {
                    return;
                }

                $adminStatus = match ($request->status) {
                    VenueChangeRequest::STATUS_APPROVED => VenueChangeRequestApproval::STATUS_APPROVED,
                    VenueChangeRequest::STATUS_REJECTED => VenueChangeRequestApproval::STATUS_REJECTED,
                    default => VenueChangeRequestApproval::STATUS_PENDING,
                };

                VenueChangeRequestApproval::query()->create([
                    'venue_change_request_id' => $request->id,
                    'role' => VenueChangeApprovalRole::ADMINISTRATOR,
                    'status' => $adminStatus,
                    'decided_by_type' => $request->reviewed_by ? \App\Models\User::class : null,
                    'decided_by_id' => $request->reviewed_by,
                    'comments' => $request->admin_comments,
                    'decided_at' => $request->reviewed_at,
                ]);
            });

        SystemSetting::query()->updateOrCreate(
            ['key' => 'notify_leadership_venue_change_request_submitted'],
            [
                'value' => '1',
                'group' => 'notifications',
                'type' => 'boolean',
                'description' => 'Notify the assigned Director/Dean and Head of Department when a venue change request is submitted',
            ],
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('venue_change_request_approvals');

        Schema::table('venue_change_requests', function (Blueprint $table) {
            $table->dropConstrainedForeignId('department_id');
            $table->dropConstrainedForeignId('faculty_id');
        });
    }
};
