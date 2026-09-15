<?php

namespace App\Listeners;

use App\Models\Teacher;
use App\Models\User;
use App\Services\ActivityLogService;
use App\Services\UnifiedAuthenticationService;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;

class LogAuthenticationEvents
{
    /**
     * Registered automatically from app/Listeners. Do not also Event::listen()
     * these methods in a service provider — that writes every login twice.
     */
    public function __construct(
        private ActivityLogService $activityLogService
    ) {}

    public function handleLogin(Login $event): void
    {
        if ($event->user instanceof User && $event->guard === 'web') {
            $event->user->forceFill(['last_login_at' => now()])->saveQuietly();
        }

        $actor = $this->resolveActorFromUser($event->user);

        $this->activityLogService->logAuthentication(
            eventType: 'login',
            description: 'User logged in successfully',
            actor: $actor,
            metadata: ['guard' => $event->guard],
        );
    }

    public function handleLogout(Logout $event): void
    {
        $actor = $this->resolveActorFromUser($event->user);

        $this->activityLogService->logAuthentication(
            eventType: 'logout',
            description: 'User logged out',
            actor: $actor,
            metadata: ['guard' => $event->guard],
        );
    }

    public function handleFailed(Failed $event): void
    {
        $actor = $event->user
            ? $this->resolveActorFromUser($event->user)
            : [
                'type' => null,
                'id' => null,
                'name' => $event->credentials['email'] ?? 'Guest',
                'role' => UnifiedAuthenticationService::roleLabel(null),
            ];

        $this->activityLogService->logAuthentication(
            eventType: 'failed_login',
            description: 'Failed login attempt for '.($event->credentials['email'] ?? 'unknown email'),
            status: ActivityLogService::STATUS_FAILED,
            actor: $actor,
            metadata: [
                'guard' => $event->guard,
                'email' => $event->credentials['email'] ?? null,
            ],
            securityFlag: true,
        );
    }

    private function resolveActorFromUser(mixed $user): array
    {
        if ($user instanceof User) {
            return [
                'type' => User::class,
                'id' => $user->id,
                'name' => $user->name,
                'role' => UnifiedAuthenticationService::roleLabel($user),
            ];
        }

        if ($user instanceof Teacher) {
            return [
                'type' => Teacher::class,
                'id' => $user->id,
                'name' => trim("{$user->first_name} {$user->last_name}"),
                'role' => UnifiedAuthenticationService::roleLabel($user),
            ];
        }

        return [
            'type' => null,
            'id' => null,
            'name' => 'Unknown',
            'role' => UnifiedAuthenticationService::roleLabel(null),
        ];
    }
}
