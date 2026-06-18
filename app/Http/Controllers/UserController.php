<?php

namespace App\Http\Controllers;

use App\Http\Requests\Admin\BulkUserActionRequest;
use App\Http\Requests\Admin\ResetUserPasswordRequest;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Models\User;
use App\Notifications\AdminUserWelcomeNotification;
use App\Services\ActivityLogService;
use App\Services\AdminUserManagementService;
use App\Services\AdminUserPasswordService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;
use Spatie\Permission\Models\Role;
use Symfony\Component\HttpFoundation\StreamedResponse;

class UserController extends Controller
{
    public function __construct(
        private AdminUserManagementService $userManagementService,
        private AdminUserPasswordService $userPasswordService,
    ) {}

    public function index(Request $request): Response
    {
        $this->authorize('viewAny', User::class);

        return Inertia::render('admin/user/index', $this->userManagementService->getIndexPayload($request));
    }

    public function create(): Response
    {
        $this->authorize('create', User::class);

        return Inertia::render('admin/user/create', [
            'roles' => Role::query()->orderBy('name')->get(['id', 'name']),
            'statusOptions' => User::STATUSES,
        ]);
    }

    public function store(StoreUserRequest $request)
    {
        $this->authorize('create', User::class);

        $validated = $request->validated();
        $temporaryPassword = Str::password(16);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'staff_id' => $validated['staff_id'],
            'password' => $temporaryPassword,
            'status' => $validated['status'] ?? User::STATUS_ACTIVE,
            'must_change_password' => true,
        ]);

        $user->syncRoles($validated['roles']);

        app(ActivityLogService::class)->logUserManagement(
            'user_created',
            "Created admin user {$user->name} ({$user->email})",
            ['user_id' => $user->id, 'roles' => $validated['roles']]
        );

        if ($request->boolean('send_welcome_email')) {
            $user->notify(new AdminUserWelcomeNotification(
                roles: $validated['roles'],
                createdByName: $request->user()->name,
            ));
        }

        return redirect()
            ->route('admin.user-management.users.index')
            ->with([
                'success' => 'User created successfully. Share the temporary password securely with the user.',
                'generatedPassword' => $temporaryPassword,
            ]);
    }

    public function edit(User $user): Response
    {
        $this->authorize('update', $user);

        return Inertia::render('admin/user/edit', [
            'user' => $user,
            'userRoles' => $user->roles->pluck('name'),
            'roles' => Role::query()->orderBy('name')->get(['id', 'name']),
            'statusOptions' => User::STATUSES,
        ]);
    }

    public function update(UpdateUserRequest $request, User $user)
    {
        $this->authorize('update', $user);

        $validated = $request->validated();

        $user->fill([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'staff_id' => $validated['staff_id'],
            'status' => $validated['status'] ?? $user->status ?? User::STATUS_ACTIVE,
        ]);

        if (($validated['status'] ?? null) === User::STATUS_ACTIVE) {
            $user->locked_at = null;
        }

        $user->save();
        $user->syncRoles($validated['roles']);

        app(ActivityLogService::class)->logUserManagement(
            'user_updated',
            "Updated admin user {$user->name} ({$user->email})",
            ['user_id' => $user->id, 'roles' => $validated['roles']]
        );

        return redirect()
            ->route('admin.user-management.users.index')
            ->with('success', 'User updated successfully!');
    }

    public function destroy(User $user)
    {
        $this->authorize('delete', $user);

        $name = $user->name;
        $email = $user->email;
        $userId = $user->id;
        $user->delete();

        app(ActivityLogService::class)->logUserManagement(
            'user_deleted',
            "Deleted admin user {$name} ({$email})",
            ['user_id' => $userId]
        );

        return redirect()
            ->route('admin.user-management.users.index')
            ->with('success', 'User deleted successfully!');
    }

    public function quickView(User $user): JsonResponse
    {
        $this->authorize('view', $user);

        return response()->json([
            'success' => true,
            'data' => $this->userManagementService->getQuickView($user),
        ]);
    }

    public function resetPassword(ResetUserPasswordRequest $request, User $user): JsonResponse
    {
        $this->authorize('resetPassword', $user);

        $result = $this->userPasswordService->reset($request->user(), $user, $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'Password reset successfully.',
            'data' => $result,
        ]);
    }

    public function updateStatus(Request $request, User $user): JsonResponse
    {
        $this->authorize('update', $user);

        $validated = $request->validate([
            'status' => ['required', Rule::in(User::STATUSES)],
        ]);

        $updated = $this->userManagementService->updateStatus($user, $validated['status']);

        return response()->json([
            'success' => true,
            'message' => 'Account status updated.',
            'data' => [
                'id' => $updated->id,
                'status' => $updated->status,
            ],
        ]);
    }

    public function bulkUpdateStatus(BulkUserActionRequest $request): JsonResponse
    {
        $validated = $request->validated();

        if (empty($validated['status'])) {
            abort(422, 'Status is required for bulk update.');
        }

        $result = $this->userManagementService->bulkUpdateStatus(
            $request->user(),
            $validated['ids'],
            $validated['status'],
        );

        return response()->json([
            'success' => true,
            'message' => "{$result['updated']} user(s) updated.",
            'data' => $result,
        ]);
    }

    public function bulkRequirePasswordChange(BulkUserActionRequest $request): JsonResponse
    {
        $result = $this->userManagementService->bulkRequirePasswordChange(
            $request->user(),
            $request->validated('ids'),
        );

        return response()->json([
            'success' => true,
            'message' => "{$result['updated']} user(s) marked for password change.",
            'data' => $result,
        ]);
    }

    public function bulkDelete(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:users,id'],
        ]);

        if (!$request->user()?->can('admin.user-management.users.delete')) {
            abort(403);
        }

        $result = $this->userManagementService->bulkDelete($request->user(), $validated['ids']);

        return response()->json([
            'success' => true,
            'message' => "{$result['deleted']} user(s) deleted.",
            'data' => $result,
        ]);
    }

    public function export(Request $request, string $format = 'csv'): StreamedResponse|\Illuminate\View\View|\Symfony\Component\HttpFoundation\BinaryFileResponse
    {
        $this->authorize('export', User::class);

        $format = strtolower($format);
        $rows = $this->userManagementService->exportRows($request);
        $fileName = 'admin_users_' . now()->format('Ymd_His');

        if ($format === 'print') {
            return view('admin.users-print', [
                'rows' => $rows,
                'generatedAt' => now()->format('Y-m-d H:i:s'),
            ]);
        }

        if ($format === 'pdf') {
            if (!class_exists(\Barryvdh\DomPDF\Facade\Pdf::class)) {
                abort(500, 'PDF export requires barryvdh/laravel-dompdf.');
            }

            $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('admin.users-print', [
                'rows' => $rows,
                'generatedAt' => now()->format('Y-m-d H:i:s'),
            ]);

            return $pdf->download($fileName . '.pdf');
        }

        if ($format === 'excel') {
            return Excel::download(new \App\Exports\GenericArrayExport($rows), $fileName . '.xlsx');
        }

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$fileName}.csv\"",
        ];

        return response()->stream(function () use ($rows) {
            $handle = fopen('php://output', 'w');

            if (!empty($rows)) {
                fputcsv($handle, array_keys($rows[0]));
                foreach ($rows as $row) {
                    fputcsv($handle, array_values($row));
                }
            }

            fclose($handle);
        }, 200, $headers);
    }
}
