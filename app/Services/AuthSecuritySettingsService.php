<?php

namespace App\Services;

use App\Models\SystemSetting;

class AuthSecuritySettingsService
{
    public function isForgotPasswordEnabled(): bool
    {
        return (bool) SystemSetting::getValue('forgot_password_enabled', true);
    }
}
