<?php

namespace App\Services;

use App\Models\SystemSetting;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FaceServiceClient
{
    /**
     * @return array<string, mixed>
     */
    public function health(): array
    {
        return $this->get('/health');
    }

    /**
     * @param  list<string>  $images
     * @return array<string, mixed>
     */
    public function enroll(array $images, bool $livenessRequired = true): array
    {
        return $this->post('/v1/face/enroll', [
            'images' => array_map([$this, 'normalizeImage'], $images),
            'liveness_required' => $livenessRequired,
        ], true);
    }

    /**
     * @param  list<string>  $livenessFrames
     * @param  list<float|int>  $storedEmbedding
     * @return array<string, mixed>
     */
    public function verify(
        string $image,
        array $livenessFrames,
        array $storedEmbedding,
        float $threshold,
        float $qualityThreshold,
        bool $livenessRequired = true,
    ): array {
        return $this->post('/v1/face/verify', [
            'image' => $this->normalizeImage($image),
            'liveness_frames' => array_map([$this, 'normalizeImage'], $livenessFrames),
            'stored_embedding' => array_map('floatval', $storedEmbedding),
            'threshold' => $threshold,
            'quality_threshold' => $qualityThreshold,
            'liveness_required' => $livenessRequired,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function get(string $path): array
    {
        return $this->send('get', $path);
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    private function post(string $path, array $body, bool $keepEmbedding = false): array
    {
        return $this->send('post', $path, $body, $keepEmbedding);
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    private function send(string $method, string $path, array $body = [], bool $keepEmbedding = false): array
    {
        if (! config('face.enabled') || ! config('face.api_key')) {
            $this->logFailure('FACE_SERVICE_ERROR', 'not_configured');
            throw new FaceServiceException(
                FacialRecognitionService::staffMessage('SERVICE_UNAVAILABLE'),
                'SERVICE_UNAVAILABLE',
            );
        }

        try {
            $request = Http::withHeaders([
                'X-Api-Key' => (string) config('face.api_key'),
                'Accept' => 'application/json',
            ])
                ->timeout($this->timeoutSeconds())
                ->connectTimeout(5)
                ->acceptJson();

            $response = $method === 'get'
                ? $request->get(config('face.url').$path)
                : $request->post(config('face.url').$path, $body);
        } catch (ConnectionException) {
            $this->logFailure('FACE_SERVICE_ERROR', 'connection_failed');
            throw new FaceServiceException(
                FacialRecognitionService::staffMessage('SERVICE_UNAVAILABLE'),
                'SERVICE_UNAVAILABLE',
            );
        }

        if ($response->status() === 401) {
            $this->logFailure('FACE_SERVICE_ERROR', 'unauthorized');
            throw new FaceServiceException(
                FacialRecognitionService::staffMessage('SERVICE_UNAVAILABLE'),
                'SERVICE_UNAVAILABLE',
            );
        }

        $payload = $response->json();
        if (! is_array($payload)) {
            $this->logFailure('FACE_SERVICE_ERROR', 'invalid_response', $response->status());
            throw new FaceServiceException(
                FacialRecognitionService::staffMessage('SERVICE_UNAVAILABLE'),
                'SERVICE_UNAVAILABLE',
            );
        }

        if ($response->failed() && ! isset($payload['status'])) {
            $this->logFailure('FACE_SERVICE_ERROR', 'http_'.$response->status(), $response->status());
            throw new FaceServiceException(
                FacialRecognitionService::staffMessage('SERVICE_UNAVAILABLE'),
                'SERVICE_UNAVAILABLE',
            );
        }

        if (! $keepEmbedding) {
            unset($payload['embedding']);
        }

        return $payload;
    }

    private function timeoutSeconds(): int
    {
        $configured = SystemSetting::getValue('face_service_timeout', null);

        return (int) ($configured ?: config('face.timeout', 15));
    }

    public function normalizeImage(string $image): string
    {
        $image = trim($image);
        if (str_starts_with($image, 'data:')) {
            $parts = explode(',', $image, 2);
            $image = $parts[1] ?? '';
        }

        return $image;
    }

    private function logFailure(string $event, string $reason, ?int $status = null): void
    {
        Log::warning($event, [
            'reason' => $reason,
            'status' => $status,
        ]);
    }
}
