<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Mark a notification as read.
     */
    public function markAsRead(Request $request, string $id)
    {
        $notification = $request->user()->unreadNotifications()->where('id', $id)->firstOrFail();
        $notification->markAsRead();

        return back();
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllAsRead(Request $request)
    {
        $request->user()->unreadNotifications->each->markAsRead();

        return back();
    }
}
