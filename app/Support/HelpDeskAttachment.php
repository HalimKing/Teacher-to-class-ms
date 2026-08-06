<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class HelpDeskAttachment
{
    /**
     * @return list<string>
     */
    public static function imageExtensions(): array
    {
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
    }

    public static function isImage(?string $filename): bool
    {
        if (!$filename) {
            return false;
        }

        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        return in_array($extension, self::imageExtensions(), true);
    }

    public static function publicUrl(?string $path): ?string
    {
        if (!$path || ! Storage::disk('public')->exists($path)) {
            return null;
        }

        return Storage::disk('public')->url($path);
    }

    public static function serve(string $path, ?string $downloadName = null, bool $asDownload = false): BinaryFileResponse
    {
        abort_unless(Storage::disk('public')->exists($path), 404);

        $absolute = Storage::disk('public')->path($path);
        $name = $downloadName ?: basename($path);
        $mime = mime_content_type($absolute) ?: 'application/octet-stream';
        $safeName = str_replace(['"', "\r", "\n"], '', $name);
        $disposition = ($asDownload ? 'attachment' : 'inline') . '; filename="' . $safeName . '"';

        return response()->file($absolute, [
            'Content-Type' => $mime,
            'Content-Disposition' => $disposition,
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
