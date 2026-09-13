<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\AuthSecuritySettingsService;
use App\Support\AuthenticatedHome;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Response;

class UnifiedLoginController extends Controller
{
    public function __construct(
        private AuthSecuritySettingsService $authSecuritySettings,
    ) {}

    public function show(Request $request): Response|RedirectResponse
    {
        if (Auth::guard('web')->check() || Auth::guard('teacher')->check()) {
            return redirect()->to(AuthenticatedHome::path($request));
        }

        return Inertia::render('auth/login', [
            'canResetPassword' => Route::has('password.request') && $this->authSecuritySettings->isForgotPasswordEnabled(),
            'status' => $request->session()->get('status'),
        ]);
    }

    public function login(Request $request): RedirectResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
            'remember' => 'sometimes|boolean',
        ]);

        $credentials = $request->only('email', 'password');
        $remember = $request->boolean('remember');

        // Match the login form: "Remember me for 30 days"
        $rememberMinutes = 60 * 24 * 30;
        Auth::guard('web')->setRememberDuration($rememberMinutes);
        Auth::guard('teacher')->setRememberDuration($rememberMinutes);

        // 1️⃣ Try admin login
        if (Auth::guard('web')->attempt($credentials, $remember)) {
            $request->session()->regenerate();

            return redirect()->to(AuthenticatedHome::path($request));
        }

        // 2️⃣ Try teacher login
        if (Auth::guard('teacher')->attempt($credentials, $remember)) {
            $request->session()->regenerate();

            return redirect()->to(AuthenticatedHome::path($request));
        }

        return back()->withErrors([
            'email' => 'Invalid email or password.',
        ]);
    }

    public function logout(Request $request)
    {
        if (Auth::guard('teacher')->check()) {
            Auth::guard('teacher')->logout();
        }

        if (Auth::guard('web')->check()) {
            Auth::guard('web')->logout();
        }

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
