<?php

namespace App\Services;

use App\Models\Teacher;
use App\Models\User;
use Illuminate\Support\Facades\Password;

class UnifiedPasswordResetService
{
    public const ACCOUNT_ADMIN = 'admin';

    public const ACCOUNT_TEACHER = 'teacher';

    /**
     * @return array{broker: string, account_type: string, model: User|Teacher}|null
     */
    public function resolveAccountByEmail(string $email): ?array
    {
        $user = User::query()->where('email', $email)->first();

        if ($user) {
            return [
                'broker' => 'users',
                'account_type' => self::ACCOUNT_ADMIN,
                'model' => $user,
            ];
        }

        $teacher = Teacher::query()->where('email', $email)->first();

        if ($teacher) {
            return [
                'broker' => 'teachers',
                'account_type' => self::ACCOUNT_TEACHER,
                'model' => $teacher,
            ];
        }

        return null;
    }

    public function brokerForAccountType(string $accountType): string
    {
        return $accountType === self::ACCOUNT_TEACHER ? 'teachers' : 'users';
    }

    public function sendResetLink(string $email): string
    {
        $account = $this->resolveAccountByEmail($email);

        if ($account === null) {
            return Password::RESET_LINK_SENT;
        }

        return Password::broker($account['broker'])->sendResetLink(['email' => $email]);
    }
}
