<?php

return [
    'url' => rtrim((string) env('FACE_SERVICE_URL', 'http://127.0.0.1:8090'), '/'),
    'api_key' => env('FACE_SERVICE_API_KEY'),
    'timeout' => (int) env('FACE_SERVICE_TIMEOUT', 15),
    'enabled' => filter_var(env('FACE_SERVICE_ENABLED', true), FILTER_VALIDATE_BOOL),
    /*
     * Optional override of the admin setting. Leave empty to use face_recognition_engine.
     * Supported values: face_api, arcface.
     */
    'engine' => env('FACE_RECOGNITION_ENGINE') ?: null,
];
