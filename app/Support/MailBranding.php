<?php

namespace App\Support;

use Illuminate\Mail\Events\MessageSending;
use Symfony\Component\Mime\Part\DataPart;
use Symfony\Component\Mime\Part\File;

class MailBranding
{
    public const LOGO_CID = 'ubids-logo@ubids.edu.gh';

    public static function logoPath(): ?string
    {
        $path = public_path('images/ubids-logo.png');

        return is_file($path) ? $path : null;
    }

    public static function logoSrc(): ?string
    {
        return self::logoPath() ? 'cid:'.self::LOGO_CID : null;
    }

    public static function embedLogo(MessageSending $event): void
    {
        $path = self::logoPath();
        $html = $event->message->getHtmlBody();

        if (! $path || ! is_string($html) || ! str_contains($html, 'cid:'.self::LOGO_CID)) {
            return;
        }

        foreach ($event->message->getAttachments() as $part) {
            if ($part->getFilename() === 'ubids-logo.png') {
                return;
            }
        }

        $part = (new DataPart(new File($path), 'ubids-logo.png', 'image/png'))->asInline();
        $part->setContentId(self::LOGO_CID);

        $event->message->addPart($part);
    }
}
