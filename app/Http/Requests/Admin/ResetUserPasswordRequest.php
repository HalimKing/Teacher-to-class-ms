<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class ResetUserPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->route('user');

        return $user instanceof User
            ? ($this->user()?->can('admin.user-management.users.reset-password') ?? false)
            : false;
    }

    public function rules(): array
    {
        return [
            'mode' => ['required', Rule::in(['generate', 'manual'])],
            'password' => ['required_if:mode,manual', 'nullable', 'string', Password::defaults(), 'confirmed'],
            'force_change_on_login' => ['sometimes', 'boolean'],
            'send_reset_link' => ['sometimes', 'boolean'],
        ];
    }
}
