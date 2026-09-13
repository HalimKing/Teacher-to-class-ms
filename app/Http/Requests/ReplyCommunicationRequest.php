<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReplyCommunicationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'parent_id' => ['required', 'integer', 'exists:communications,id'],
            'mode' => ['required', 'in:reply,reply_all'],
            'body' => ['required', 'string', 'max:10000'],
        ];
    }

    /**
     * @return array{parent_id: int, mode: string, body: string}
     */
    public function payload(): array
    {
        return [
            'parent_id' => (int) $this->input('parent_id'),
            'mode' => (string) $this->input('mode'),
            'body' => trim((string) $this->input('body')),
        ];
    }
}
