<?php

namespace App\Providers;

use App\Models\Teacher;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

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
    }
}
