<?php

namespace App\Providers;

use App\Listeners\LogAuthenticationEvents;
use App\Models\Teacher;
use App\Services\ActivityLogService;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Spatie\Permission\Exceptions\UnauthorizedException;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::define('view-lecturer-attendance', fn ($user): bool => $user instanceof Teacher && $user->isLecturer());
        Gate::define('view-class-attendance', fn ($user): bool => $user instanceof Teacher && $user->isLecturer());
        Gate::define('view-staff-attendance', fn ($user): bool => $user instanceof Teacher && $user->isAdministrator());

        Event::listen(Login::class, [LogAuthenticationEvents::class, 'handleLogin']);
        Event::listen(Logout::class, [LogAuthenticationEvents::class, 'handleLogout']);
        Event::listen(Failed::class, [LogAuthenticationEvents::class, 'handleFailed']);
    }
}
