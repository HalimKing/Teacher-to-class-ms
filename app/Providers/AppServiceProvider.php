<?php

namespace App\Providers;

use App\Listeners\LogAuthenticationEvents;
use App\Models\Teacher;
use App\Services\ActivityLogService;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use App\Services\UnifiedPasswordResetService;
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

        ResetPassword::createUrlUsing(function (object $notifiable, string $token) {
            $accountType = $notifiable instanceof Teacher
                ? UnifiedPasswordResetService::ACCOUNT_TEACHER
                : UnifiedPasswordResetService::ACCOUNT_ADMIN;

            return url(route('password.reset', [
                'token' => $token,
                'email' => $notifiable->getEmailForPasswordReset(),
                'account_type' => $accountType,
            ], false));
        });

        ResetPassword::toMailUsing(function (object $notifiable, string $token) {
            $accountLabel = $notifiable instanceof Teacher
                ? 'lecturer/administrator'
                : 'admin';

            $url = url(route('password.reset', [
                'token' => $token,
                'email' => $notifiable->getEmailForPasswordReset(),
                'account_type' => $notifiable instanceof Teacher
                    ? UnifiedPasswordResetService::ACCOUNT_TEACHER
                    : UnifiedPasswordResetService::ACCOUNT_ADMIN,
            ], false));

            $expireMinutes = config('auth.passwords.users.expire', 60);

            return (new MailMessage)
                ->subject('Reset your ' . config('app.name') . ' password')
                ->greeting('Hello ' . ($notifiable->name ?? $notifiable->first_name ?? 'there') . ',')
                ->line("We received a password reset request for your {$accountLabel} account.")
                ->action('Reset password', $url)
                ->line("This link expires in {$expireMinutes} minutes.")
                ->line('If you did not request a reset, you can ignore this email.');
        });
    }
}
