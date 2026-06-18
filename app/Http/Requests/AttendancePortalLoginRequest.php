<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AttendancePortalLoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'staff_id' => ['required', 'string', 'max:100'],
        ];
    }

    public function messages(): array
    {
        return [
            'staff_id.required' => 'Please enter your Staff ID.',
        ];
    }
}
