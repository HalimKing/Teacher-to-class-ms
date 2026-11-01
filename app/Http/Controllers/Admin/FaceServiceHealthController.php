<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\FaceServiceClient;
use App\Services\FaceServiceException;
use App\Services\FacialRecognitionService;
use Illuminate\Http\JsonResponse;

class FaceServiceHealthController extends Controller
{
    public function __invoke(FacialRecognitionService $facialRecognition, FaceServiceClient $client): JsonResponse
    {
        if (! $facialRecognition->usesArcFace()) {
            return response()->json([
                'status' => 'ok',
                'engine' => 'face_api',
                'model_loaded' => false,
                'model' => 'face-api.js',
                'runtime' => 'browser',
            ]);
        }

        try {
            $health = $client->health();
        } catch (FaceServiceException) {
            return response()->json([
                'status' => 'degraded',
                'engine' => 'arcface',
                'model_loaded' => false,
                'model' => 'ArcFace',
                'runtime' => 'onnxruntime',
            ], 503);
        }

        return response()->json([
            'status' => ($health['model_loaded'] ?? false) ? 'ok' : 'degraded',
            'engine' => 'arcface',
            'model_loaded' => (bool) ($health['model_loaded'] ?? false),
            'model' => $health['model'] ?? 'ArcFace',
            'runtime' => $health['runtime'] ?? 'onnxruntime',
            'liveness_model_loaded' => (bool) ($health['liveness_model_loaded'] ?? false),
        ], ($health['model_loaded'] ?? false) ? 200 : 503);
    }
}
