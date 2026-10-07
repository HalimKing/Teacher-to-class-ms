<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\Teacher;
use App\Models\User;
use App\Services\ActivityLogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class PasswordController extends Controller
{
    public function edit(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('settings/password', [
            'mustChangePassword' => $user instanceof User && $user->must_change_password,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();
        $forceChange = $user instanceof User && $user->must_change_password;

        $rules = [
            'password' => ['required', Password::defaults(), 'confirmed'],
        ];

        if (!$forceChange) {
            $guard = $user instanceof Teacher ? 'teacher' : 'web';
            $rules['current_password'] = ['required', "current_password:{$guard}"];
        }

        $validated = $request->validate($rules);

        $user->password = $validated['password'];
        if ($user instanceof User) {
            $user->must_change_password = false;
        }
        $user->password_changed_at = now();
        $user->save();

        if ($user instanceof Teacher) {
            app(ActivityLogService::class)->logAccount(
                'password_changed',
                'Changed account password',
                [
                    'resource_type' => 'account',
                    'resource_id' => $user->id,
                    'resource_label' => 'Password',
                ],
            );
        }

        $home = $user instanceof Teacher ? 'teacher.dashboard' : 'admin.dashboard';

        return redirect()
            ->route($home)
            ->with('success', 'Password updated successfully.');
    }
}
