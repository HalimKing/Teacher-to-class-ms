<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Teacher;
use App\Models\User;
use App\Services\AuthSecuritySettingsService;
use App\Services\UnifiedPasswordResetService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class NewPasswordController extends Controller
{
    public function __construct(
        private UnifiedPasswordResetService $passwordResetService,
        private AuthSecuritySettingsService $authSecuritySettings,
    ) {}

    public function create(Request $request): Response|RedirectResponse
    {
        if ($redirect = $this->redirectIfForgotPasswordDisabled()) {
            return $redirect;
        }
        $accountType = $request->query('account_type', UnifiedPasswordResetService::ACCOUNT_ADMIN);

        if (!in_array($accountType, [UnifiedPasswordResetService::ACCOUNT_ADMIN, UnifiedPasswordResetService::ACCOUNT_TEACHER], true)) {
            $accountType = UnifiedPasswordResetService::ACCOUNT_ADMIN;
        }

        return Inertia::render('auth/reset-password', [
            'email' => $request->string('email')->toString(),
            'token' => $request->route('token'),
            'accountType' => $accountType,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        if ($redirect = $this->redirectIfForgotPasswordDisabled()) {
            return $redirect;
        }

        $request->validate([
            'token' => ['required'],
            'email' => ['required', 'email'],
            'account_type' => [
                'required',
                Rule::in([
                    UnifiedPasswordResetService::ACCOUNT_ADMIN,
                    UnifiedPasswordResetService::ACCOUNT_TEACHER,
                ]),
            ],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $broker = $this->passwordResetService->brokerForAccountType($request->string('account_type')->toString());

        $status = Password::broker($broker)->reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User|Teacher $account) use ($request) {
                $account->forceFill([
                    'password' => $request->string('password')->toString(),
                    'remember_token' => Str::random(60),
                ]);

                if ($account instanceof User) {
                    $account->must_change_password = false;
                    $account->password_changed_at = now();
                }

                if ($account instanceof Teacher) {
                    $account->password_changed_at = now()->toDateTimeString();
                }

                $account->save();

                event(new PasswordReset($account));
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return to_route('login')->with('status', __('Your password has been reset. You can now sign in.'));
        }

        throw ValidationException::withMessages([
            'email' => [__($status)],
        ]);
    }

    private function redirectIfForgotPasswordDisabled(): ?RedirectResponse
    {
        if (!$this->authSecuritySettings->isForgotPasswordEnabled()) {
            return redirect()
                ->route('login')
                ->withErrors([
                    'email' => __('Password reset is currently disabled. Please contact your administrator.'),
                ]);
        }

        return null;
    }
}
