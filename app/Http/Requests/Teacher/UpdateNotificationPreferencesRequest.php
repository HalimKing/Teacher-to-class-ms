<?php

namespace App\Http\Requests\Teacher;

use Illuminate\Foundation\Http\FormRequest;

class UpdateNotificationPreferencesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth('teacher')->check();
    }

    public function rules(): array
    {
        return [
            'attendance_enabled' => ['required', 'boolean'],
            'timetable_enabled' => ['required', 'boolean'],
            'administrative_enabled' => ['required', 'boolean'],
            'system_enabled' => ['required', 'boolean'],
            'email_enabled' => ['required', 'boolean'],
        ];
    }
}
