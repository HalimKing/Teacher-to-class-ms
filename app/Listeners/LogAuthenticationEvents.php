<?php

namespace App\Listeners;

use App\Models\Teacher;
use App\Models\User;
use App\Services\ActivityLogService;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;

class LogAuthenticationEvents
{
    public function __construct(
        private ActivityLogService $activityLogService
    ) {}

    public function handleLogin(Login $event): void
    {
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
        $this->activityLogService->logAuthentication(
            eventType: 'failed_login',
            description: 'Failed login attempt for ' . ($event->credentials['email'] ?? 'unknown email'),
            status: ActivityLogService::STATUS_FAILED,
            actor: [
                'type' => null,
                'id' => null,
                'name' => $event->credentials['email'] ?? 'Guest',
                'role' => 'guest',
            ],
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
                'role' => 'admin',
            ];
        }

        if ($user instanceof Teacher) {
            return [
                'type' => Teacher::class,
                'id' => $user->id,
                'name' => trim("{$user->first_name} {$user->last_name}"),
                'role' => $user->staff_type === Teacher::STAFF_TYPE_ADMINISTRATOR ? 'administrator' : 'teacher',
            ];
        }

        return [
            'type' => null,
            'id' => null,
            'name' => 'Unknown',
            'role' => 'guest',
        ];
    }
}
