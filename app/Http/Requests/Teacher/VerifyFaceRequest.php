<?php

namespace App\Http\Requests\Teacher;

use Illuminate\Foundation\Http\FormRequest;

class VerifyFaceRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'timetable_id' => ['required', 'exists:time_tables,id'],
            'face_descriptor' => ['required', 'array', 'size:128'],
            'face_descriptor.*' => ['required', 'numeric'],
            'quality.detection_confidence' => ['required', 'numeric', 'min:0.7', 'max:1'],
            'quality.face_width' => ['required', 'numeric', 'min:80'],
            'quality.face_height' => ['required', 'numeric', 'min:80'],
            'quality.frame_count' => ['required', 'integer', 'min:3'],
            'quality.descriptor_variance' => ['required', 'numeric', 'max:0.18'],
        ];
    }
}
