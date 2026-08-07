<?php

namespace App\Support;

class PasswordShareSession
{
    public static function store(string $type, int $id, string $plainPassword): void
    {
        session([self::key($type, $id) => encrypt($plainPassword)]);
    }

    public static function get(string $type, int $id): ?string
    {
        $encrypted = session(self::key($type, $id));

        if (! is_string($encrypted) || $encrypted === '') {
            return null;
        }

        try {
            $plain = decrypt($encrypted);

            return is_string($plain) && $plain !== '' ? $plain : null;
        } catch (\Throwable) {
            return null;
        }
    }

    public static function forget(string $type, int $id): void
    {
        session()->forget(self::key($type, $id));
    }

    public static function has(string $type, int $id): bool
    {
        return self::get($type, $id) !== null;
    }

    private static function key(string $type, int $id): string
    {
        return "password_share.{$type}.{$id}";
    }
}
