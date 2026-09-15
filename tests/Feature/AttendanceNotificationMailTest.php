<?php

use App\Models\Teacher;
use App\Notifications\LecturerAlertNotification;
use App\Support\LecturerNotificationPayload;
use Illuminate\Mail\Markdown;

function absenceNotificationMail(): array
{
    $teacher = new Teacher([
        'title' => 'Mr.',
        'first_name' => 'Salahudeen',
        'last_name' => 'Abdul-Halim',
        'email' => 'salahudeen@example.com',
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
    ]);

    $notification = new LecturerAlertNotification(
        LecturerNotificationPayload::make(
            type: 'auto_absence_recorded',
            category: LecturerNotificationPayload::CATEGORY_ATTENDANCE,
            priority: LecturerNotificationPayload::PRIORITY_HIGH,
            title: 'Attendance Session Expired',
            message: 'Your attendance session has expired without a successful check-in. You have been marked absent for this session.',
            url: '/teacher/staff-attendance',
        ),
        ['mail'],
    );

    $message = $notification->toMail($teacher);

    return [$message, (string) app(Markdown::class)->render('notifications::email', $message->data())];
}

it('keeps the absence notification subject and dynamic bindings intact', function () {
    [$message, $html] = absenceNotificationMail();

    expect($message->subject)->toBe('Attendance Session Expired');

    expect($html)
        ->toContain('Hello Mr. Salahudeen,')
        ->toContain('Attendance Session Expired')
        ->toContain('You have been marked absent for this session.')
        ->toContain('Open Attendance Portal')
        ->toContain('Thank you for using '.config('app.name'))
        ->toContain('Regards,');
});

it('points the portal button and fallback link at the attendance portal', function () {
    [, $html] = absenceNotificationMail();

    $portalUrl = url('/teacher/staff-attendance');

    expect(substr_count($html, $portalUrl))->toBeGreaterThanOrEqual(2);
    expect($html)->toContain('href="'.$portalUrl.'"');
});

it('renders the branded institutional shell around the notification', function () {
    [, $html] = absenceNotificationMail();

    expect($html)
        ->toContain('background-color: #0b2a4a')
        ->toContain('background-color: #c8a24a')
        ->toContain('cid:'.\App\Support\MailBranding::LOGO_CID)
        ->toContain(config('app.name'))
        ->toContain(config('mail.from.address'))
        ->toContain('max-width: 620px');
});

it('embeds the campus logo inside the sent message so mail clients can display it', function () {
    $teacher = new Teacher([
        'title' => 'Mr.',
        'first_name' => 'Mona',
        'email' => 'mona.logo@example.com',
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
    ]);

    $teacher->notify(new LecturerAlertNotification(
        LecturerNotificationPayload::make(
            type: 'auto_absence_recorded',
            category: LecturerNotificationPayload::CATEGORY_ATTENDANCE,
            priority: LecturerNotificationPayload::PRIORITY_HIGH,
            title: 'Testing Template',
            message: 'Here is where the main body content goes in',
            url: '/teacher/staff-attendance',
        ),
        ['mail'],
    ));

    $sent = app('mailer')->getSymfonyTransport()->messages()->last();
    expect($sent)->not->toBeNull();

    /** @var \Symfony\Component\Mime\Email $email */
    $email = $sent->getOriginalMessage();
    $html = (string) $email->getHtmlBody();
    $logo = collect($email->getAttachments())->first(
        fn ($part) => $part->getFilename() === 'ubids-logo.png'
    );

    expect($html)->toContain('cid:'.\App\Support\MailBranding::LOGO_CID)
        ->and($html)->not->toContain('images/ubids-logo.png')
        ->and($logo)->not->toBeNull()
        ->and($logo->getContentId())->toBe(\App\Support\MailBranding::LOGO_CID)
        ->and($logo->getDisposition())->toBe('inline');
});
