<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Attendance portal session timeout (minutes)
    |--------------------------------------------------------------------------
    */
    'timeout_minutes' => (int) env('ATTENDANCE_PORTAL_TIMEOUT', 30),

    /*
    |--------------------------------------------------------------------------
    | Allowed URL path prefixes while in attendance portal mode
    |--------------------------------------------------------------------------
    */
    'allowed_path_prefixes' => [
        'attendance',
        'teacher/attendance',
        'teacher/staff-attendance',
    ],

    /*
    |--------------------------------------------------------------------------
    | Rate limit: max Staff ID attempts per minute
    |--------------------------------------------------------------------------
    */
    'login_rate_limit' => (int) env('ATTENDANCE_PORTAL_LOGIN_RATE_LIMIT', 10),
];
