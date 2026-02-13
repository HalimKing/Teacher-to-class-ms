<?php

namespace App\Policies;

use App\Models\SystemSetting;
use App\Models\User;

/**
 * Only admin (web guard) can view/update system settings.
 * Teachers have no access.
 */
class SystemSettingPolicy
{
    /**
     * View system settings (dashboard).
     */
    public function viewAny(User $user): bool
    {
        return $user->can('admin.settings.view');
    }

    /**
     * Update system settings.
     */
    public function update(User $user): bool
    {
        return $user->can('admin.settings.edit');
    }
}
