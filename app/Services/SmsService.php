<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;

class SmsService
{
    /**
     * Send an SMS to a phone number.
     * Driver is configurable via `config('services.sms.driver')` — defaults to `log`.
     */
    public static function send(?string $phone, string $message): bool
    {
        if (empty($phone)) {
            throw new \InvalidArgumentException('Phone number is required to send SMS');
        }

        $driver = config('services.sms.driver', 'log');

        if ($driver === 'log') {
            Log::info(sprintf('[SMS] to=%s message=%s', $phone, $message));
            return true;
        }

        if ($driver === 'twilio') {
            $sid = config('services.sms.twilio.account_sid');
            $token = config('services.sms.twilio.auth_token');
            $from = config('services.sms.twilio.from');

            if (empty($sid) || empty($token) || empty($from)) {
                throw new \RuntimeException('Twilio SMS not configured (TWILIO_ACCOUNT_SID/AUTH_TOKEN/TWILIO_FROM)');
            }

            $url = "https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json";

            $response = Http::withBasicAuth($sid, $token)
                ->asForm()
                ->post($url, [
                    'From' => $from,
                    'To' => $phone,
                    'Body' => $message,
                ]);

            if ($response->successful()) {
                Log::info('[SMS][twilio] sent', ['to' => $phone, 'sid' => $response->json('sid')]);
                return true;
            }

            Log::error('[SMS][twilio] failed', ['to' => $phone, 'status' => $response->status(), 'body' => $response->body()]);
            throw new \RuntimeException('Twilio error: ' . $response->body());
        }

        // Unknown driver
        throw new \RuntimeException('SMS driver "' . $driver . '" is not implemented');
    }
}
