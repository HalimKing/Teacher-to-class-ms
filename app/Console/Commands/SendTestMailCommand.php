<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class SendTestMailCommand extends Command
{
    protected $signature = 'mail:test {email? : Recipient email address}';

    protected $description = 'Send a test email using the configured mailer';

    public function handle(): int
    {
        $to = $this->argument('email') ?? config('mail.from.address');

        if (!$to) {
            $this->error('No recipient email. Pass an email argument or set MAIL_FROM_ADDRESS.');

            return self::FAILURE;
        }

        $this->info('Mailer: ' . config('mail.default'));
        $this->info('Host: ' . config('mail.mailers.smtp.host') . ':' . config('mail.mailers.smtp.port'));

        try {
            Mail::raw(
                'This is a test email from ' . config('app.name') . '. If you received this, mail is configured correctly.',
                function ($message) use ($to) {
                    $message->to($to)->subject(config('app.name') . ' — mail configuration test');
                }
            );

            $this->info("Test email sent to {$to}");

            return self::SUCCESS;
        } catch (\Throwable $exception) {
            $this->error('Failed to send test email: ' . $exception->getMessage());

            return self::FAILURE;
        }
    }
}
