<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('admin.user-management.users.view');
    }

    public function view(User $user, User $model): bool
    {
        return $user->can('admin.user-management.users.view');
    }

    public function create(User $user): bool
    {
        return $user->can('admin.user-management.users.create');
    }

    public function update(User $user, User $model): bool
    {
        return $user->can('admin.user-management.users.edit');
    }

    public function delete(User $user, User $model): bool
    {
        if ($user->id === $model->id) {
            return false;
        }

        return $user->can('admin.user-management.users.delete');
    }

    public function resetPassword(User $user, User $model): bool
    {
        if ($user->id === $model->id) {
            return false;
        }

        return $user->can('admin.user-management.users.reset-password');
    }

    public function export(User $user): bool
    {
        return $user->can('admin.user-management.users.export');
    }
}
