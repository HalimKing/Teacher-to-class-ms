<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCommunicationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'subject' => ['required', 'string', 'max:180'],
            'body' => ['required', 'string', 'max:10000'],
            'save_as_draft' => ['sometimes', 'boolean'],
            'all_faculties' => ['sometimes', 'boolean'],
            'all_departments' => ['sometimes', 'boolean'],
            'all_staff' => ['sometimes', 'boolean'],
            'faculty_ids' => ['sometimes', 'array'],
            'faculty_ids.*' => ['integer', 'exists:faculties,id'],
            'department_ids' => ['sometimes', 'array'],
            'department_ids.*' => ['integer', 'exists:departments,id'],
            'staff_ids' => ['sometimes', 'array'],
            'staff_ids.*' => ['integer', 'exists:teachers,id'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(): array
    {
        return [
            'subject' => $this->input('subject'),
            'body' => $this->input('body'),
            'all_faculties' => $this->boolean('all_faculties'),
            'all_departments' => $this->boolean('all_departments'),
            'all_staff' => $this->boolean('all_staff'),
            'faculty_ids' => $this->input('faculty_ids', []),
            'department_ids' => $this->input('department_ids', []),
            'staff_ids' => $this->input('staff_ids', []),
        ];
    }
}
