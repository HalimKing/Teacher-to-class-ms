<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
use JsonException;
use Throwable;

/**
 * Encrypted JSON array that returns null instead of throwing when the
 * payload cannot be decrypted (for example after an APP_KEY change).
 *
 * @implements CastsAttributes<array<int|string, mixed>|null, array<int|string, mixed>|null>
 */
class NullableEncryptedArray implements CastsAttributes
{
    public function get(object $model, string $key, mixed $value, array $attributes): ?array
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            $decoded = Crypt::decrypt($value, false);
            $data = json_decode((string) $decoded, true, 512, JSON_THROW_ON_ERROR);

            return is_array($data) ? $data : null;
        } catch (DecryptException|JsonException|Throwable) {
            return null;
        }
    }

    public function set(object $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_string($value)) {
            $value = json_decode($value, true) ?? $value;
        }

        return Crypt::encrypt(json_encode($value, JSON_THROW_ON_ERROR), false);
    }
}
