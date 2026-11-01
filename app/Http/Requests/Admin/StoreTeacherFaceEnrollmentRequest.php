<?php

namespace App\Http\Requests\Admin;

use App\Services\FacialRecognitionService;
use Illuminate\Foundation\Http\FormRequest;

class StoreTeacherFaceEnrollmentRequest extends FormRequest
{
    public function messages(): array
    {
        return [
            'images.required' => 'Face capture data is missing. Please capture the face again.',
            'images.min' => 'Capture at least two clear face samples before saving enrollment.',
        ];
    }

    public function rules(): array
    {
        if (app(FacialRecognitionService::class)->usesArcFace()) {
            return [
                'images' => ['required', 'array', 'min:2', 'max:3'],
                'images.*' => ['required', 'string', 'min:32', 'max:3000000'],
            ];
        }

        return [
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
