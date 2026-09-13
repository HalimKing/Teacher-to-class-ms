<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreSelfReportedAbsenceRequest extends FormRequest
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
            'timetable_id' => ['required', 'integer', 'exists:time_tables,id'],
            'reason' => ['required', 'string', 'min:10', 'max:4000'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reason.required' => 'Please explain why you are marking yourself absent.',
            'reason.min' => 'The absence reason must be at least 10 characters.',
            'reason.max' => 'The absence reason may not be longer than 4000 characters.',
            'notes.max' => 'Supporting information may not be longer than 2000 characters.',
            'timetable_id.required' => 'The attendance session is missing.',
            'timetable_id.exists' => 'The selected attendance session is invalid.',
        ];
    }
}
