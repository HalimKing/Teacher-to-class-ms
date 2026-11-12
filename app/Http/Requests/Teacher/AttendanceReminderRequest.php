<?php

namespace App\Http\Requests\Teacher;

use App\Models\AttendanceReminder;
use App\Models\Teacher;
use App\Models\TimeTable;
use App\Services\AttendanceReminderService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class AttendanceReminderRequest extends FormRequest
{
    public function authorize(): bool
    {
        $teacher = $this->user('teacher');

        if (! $teacher instanceof Teacher || ! $teacher->isAdministrator()) {
            return false;
        }

        $reminder = $this->route('attendanceReminder');

        if ($reminder instanceof AttendanceReminder) {
            return (int) $reminder->teacher_id === (int) $teacher->id;
        }

        return app(AttendanceReminderService::class)->canCreate($teacher);
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:120'],
            'type' => ['required', Rule::in([AttendanceReminder::TYPE_CHECK_IN, AttendanceReminder::TYPE_CHECK_OUT])],
            'timetable_ids' => ['required', 'array', 'min:1'],
            'timetable_ids.*' => ['integer', 'min:1'],
            'trigger' => ['required', Rule::in([
                AttendanceReminder::TRIGGER_BEFORE_START,
                AttendanceReminder::TRIGGER_AFTER_START,
                AttendanceReminder::TRIGGER_BEFORE_END,
                AttendanceReminder::TRIGGER_AFTER_END,
            ])],
            'offset_minutes' => ['required', 'integer', 'min:0', 'max:180'],
            'send_via' => ['required', Rule::in([
                AttendanceReminder::VIA_MAIL,
                AttendanceReminder::VIA_SMS,
                AttendanceReminder::VIA_BOTH,
            ])],
            'message' => ['nullable', 'string', 'max:500'],
            'is_active' => ['required', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'timetable_ids.required' => 'Select at least one schedule assigned to you.',
            'timetable_ids.min' => 'Select at least one schedule assigned to you.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $teacher = $this->user('teacher');

            if (! $teacher instanceof Teacher) {
                return;
            }

            $ids = collect($this->input('timetable_ids', []))->map(fn ($id) => (int) $id)->unique()->filter()->values();
            $owned = TimeTable::query()
                ->where('teacher_id', $teacher->id)
                ->where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR)
                ->whereIn('id', $ids)
                ->count();

            if ($ids->isEmpty() || $owned !== $ids->count()) {
                $validator->errors()->add('timetable_ids', 'Select only schedules assigned to you.');
            }
        });
    }
}
