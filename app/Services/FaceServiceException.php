<?php

namespace App\Services;

use RuntimeException;

class FaceServiceException extends RuntimeException
{
    public function __construct(
        public readonly string $publicMessage,
        public readonly string $errorCode = 'SERVICE_UNAVAILABLE',
        int $status = 503,
    ) {
        parent::__construct($publicMessage, $status);
    }
}
