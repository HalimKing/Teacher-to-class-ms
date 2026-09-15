<?php

namespace App\Services;

use App\Models\Teacher;
use App\Models\User;
use Illuminate\Auth\Events\Failed;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Support\Facades\Auth;

class UnifiedAuthenticationService
{
    public const REMEMBER_MINUTES = 60 * 24 * 30;

    /**
     * Authenticate against admin users and staff in one pass.
     *
     * Looks up every matching account before attempting a password check so
     * Laravel does not emit a Failed event for the first guard when the
     * person actually lives in another table.
     */
    public function attempt(array $credentials, bool $remember = false): bool
    {
        $candidates = $this->candidatesForEmail((string) ($credentials['email'] ?? ''));

        foreach ($candidates as $candidate) {
            if ($this->loginCandidate($candidate['guard'], $candidate['user'], $credentials, $remember)) {
                return true;
            }
        }

        $this->recordFailedAttempt($credentials, $candidates[0] ?? null);

        return false;
    }

    /**
     * @return list<array{guard: string, user: Authenticatable}>
     */
    private function candidatesForEmail(string $email): array
    {
        $candidates = [];

        $admin = Auth::guard('web')->getProvider()->retrieveByCredentials(['email' => $email]);
        if ($admin instanceof Authenticatable) {
            $candidates[] = ['guard' => 'web', 'user' => $admin];
        }

        $staff = Auth::guard('teacher')->getProvider()->retrieveByCredentials(['email' => $email]);
        if ($staff instanceof Authenticatable) {
            $candidates[] = ['guard' => 'teacher', 'user' => $staff];
        }

        return $candidates;
    }

    /**
     * @param  array<string, mixed>  $credentials
     */
    private function loginCandidate(string $guardName, Authenticatable $user, array $credentials, bool $remember): bool
    {
        $guard = Auth::guard($guardName);
        $provider = $guard->getProvider();

        if (! $provider->validateCredentials($user, $credentials)) {
            return false;
        }

        if (method_exists($provider, 'rehashPasswordIfRequired')) {
            $provider->rehashPasswordIfRequired($user, $credentials);
        }

        $guard->setRememberDuration(self::REMEMBER_MINUTES);
        $guard->login($user, $remember);

        return true;
    }

    /**
     * @param  array<string, mixed>  $credentials
     * @param  array{guard: string, user: Authenticatable}|null  $candidate
     */
    private function recordFailedAttempt(array $credentials, ?array $candidate): void
    {
        event(new Failed(
            $candidate['guard'] ?? 'web',
            $candidate['user'] ?? null,
            $credentials,
        ));
    }

    public static function roleLabel(mixed $user): string
    {
        if ($user instanceof User) {
            return 'Administrator';
        }

        if ($user instanceof Teacher) {
            return $user->leadershipRoleLabel()
                ?? ($user->isAdministrator() ? 'Administrator' : 'Lecturer');
        }

        return 'Guest';
    }
}
