<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreSelfReportedAbsenceReplyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user('teacher') !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'min:5', 'max:4000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'body.required' => 'Please write a reply before sending.',
            'body.min' => 'The reply must be at least 5 characters.',
            'body.max' => 'The reply may not be longer than 4000 characters.',
        ];
    }
}
