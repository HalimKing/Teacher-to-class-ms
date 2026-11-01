<?php

namespace App\Http\Requests\Teacher;

use App\Services\FacialRecognitionService;
use Illuminate\Foundation\Http\FormRequest;

class VerifyFaceRequest extends FormRequest
{
    public function messages(): array
    {
        return [
            'face_descriptor.required' => 'Face capture data is missing. Please capture your face again.',
            'face_descriptor.size' => 'Face capture data is incomplete. Please capture your face again.',
            'quality.detection_confidence.required' => 'Face quality data is missing. Please capture your face again.',
            'image.required' => 'Face capture data is missing. Please capture your face again.',
            'liveness_frames.required' => 'Face capture data is missing. Please capture your face again.',
            'liveness_frames.min' => 'Face capture data is missing. Please capture your face again.',
        ];
    }

    public function rules(): array
    {
        if (app(FacialRecognitionService::class)->usesArcFace()) {
            return [
                'timetable_id' => ['required', 'exists:time_tables,id'],
                'image' => ['required', 'string', 'min:32', 'max:3000000'],
                'liveness_frames' => ['required', 'array', 'min:2', 'max:3'],
                'liveness_frames.*' => ['required', 'string', 'min:32', 'max:3000000'],
            ];
        }

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
