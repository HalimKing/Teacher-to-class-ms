<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\AuthSecuritySettingsService;
use App\Services\UnifiedPasswordResetService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PasswordResetLinkController extends Controller
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

        return Inertia::render('auth/forgot-password', [
            'status' => $request->session()->get('status'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        if ($redirect = $this->redirectIfForgotPasswordDisabled()) {
            return $redirect;
        }
        $request->validate([
            'email' => ['required', 'email'],
        ]);

        $this->passwordResetService->sendResetLink($request->string('email')->toString());

        return back()->with('status', __('A reset link will be sent if the account exists.'));
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
