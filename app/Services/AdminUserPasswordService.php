<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class AdminUserPasswordService
{
    public function __construct(
        private ActivityLogService $activityLogService,
    ) {}

    public function reset(User $actor, User $target, array $data): array
    {
        if ($actor->id === $target->id) {
            abort(403, 'You cannot reset your own password through this action.');
        }

        $mode = $data['mode'] ?? 'generate';
        $forceChange = (bool) ($data['force_change_on_login'] ?? true);
        $sendResetLink = (bool) ($data['send_reset_link'] ?? false);

        $plainPassword = null;

        if ($mode === 'manual') {
            $plainPassword = (string) $data['password'];
            $target->password = $plainPassword;
        } else {
            $plainPassword = Str::password(16);
            $target->password = $plainPassword;
        }

        $target->must_change_password = $forceChange;

        if ($forceChange) {
            $target->password_changed_at = null;
        } else {
            $target->password_changed_at = now();
        }

        $target->save();

        DB::table('sessions')->where('user_id', $target->id)->delete();

        $notificationSent = false;

        if ($sendResetLink) {
            Password::sendResetLink(['email' => $target->email]);
            $notificationSent = true;
        }

        $this->activityLogService->logSecurityEvent(
            eventType: 'admin_password_reset',
            description: "Password reset for admin user {$target->name} ({$target->email})",
            metadata: [
                'target_user_id' => $target->id,
                'target_email' => $target->email,
                'method' => $mode,
                'force_change_on_login' => $forceChange,
                'notification_sent' => $notificationSent,
                'performed_by' => $actor->id,
            ],
            status: ActivityLogService::STATUS_SUCCESS,
        );

        $this->activityLogService->logUserManagement(
            'user_password_reset',
            "Password reset for {$target->name} ({$target->email})",
            [
                'user_id' => $target->id,
                'method' => $mode,
                'force_change_on_login' => $forceChange,
                'notification_sent' => $notificationSent,
            ]
        );

        return [
            'temporary_password' => $mode === 'generate' ? $plainPassword : null,
            'notification_sent' => $notificationSent,
            'force_change_on_login' => $forceChange,
        ];
    }
}
