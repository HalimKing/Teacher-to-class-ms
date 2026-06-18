<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Http\Requests\Teacher\UpdateNotificationPreferencesRequest;
use App\Models\TeacherNotificationPreference;
use App\Services\LecturerNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class NotificationController extends Controller
{
    public function __construct(
        private LecturerNotificationService $notificationService,
    ) {}

    public function index(Request $request): Response
    {
        $teacher = $request->user();
        $query = $teacher->notifications();

        if ($request->filled('status') && $request->status !== 'all') {
            if ($request->status === 'unread') {
                $query->whereNull('read_at');
            } elseif ($request->status === 'read') {
                $query->whereNotNull('read_at');
            }
        }

        if ($request->filled('category') && $request->category !== 'all') {
            $query->where('data->category', $request->category);
        }

        if ($request->filled('priority') && $request->priority !== 'all') {
            $query->where('data->priority', $request->priority);
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->search);
            $query->where(function ($inner) use ($search) {
                $inner->where('data->title', 'like', "%{$search}%")
                    ->orWhere('data->message', 'like', "%{$search}%");
            });
        }

        $sort = $request->get('sort', 'latest');
        if ($sort === 'oldest') {
            $query->orderBy('created_at');
        } else {
            $query->latest();
        }

        $notifications = $query->paginate(min(max((int) $request->get('per_page', 15), 5), 50))
            ->withQueryString()
            ->through(fn ($notification) => [
                'id' => $notification->id,
                'type' => $notification->type,
                'data' => \App\Support\LecturerNotificationPayload::normalize($notification->data ?? []),
                'read_at' => $notification->read_at?->toIso8601String(),
                'created_at' => $notification->created_at->toIso8601String(),
            ]);

        return Inertia::render('teacher/notifications/index', [
            'notifications' => $notifications,
            'preferences' => TeacherNotificationPreference::forTeacher($teacher),
            'filters' => $request->only(['search', 'status', 'category', 'priority', 'sort', 'per_page']),
            'unreadCount' => $teacher->unreadNotifications()->count(),
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        $teacher = $request->user();

        return response()->json([
            'success' => true,
            'unreadCount' => $teacher->unreadNotifications()->count(),
            'items' => $this->notificationService->mapNotifications(
                $teacher->unreadNotifications()->latest()->take(10)->get()
            ),
        ]);
    }

    public function preferences(Request $request): Response
    {
        return Inertia::render('teacher/notifications/preferences', [
            'preferences' => TeacherNotificationPreference::forTeacher($request->user()),
        ]);
    }

    public function updatePreferences(UpdateNotificationPreferencesRequest $request)
    {
        $preferences = TeacherNotificationPreference::forTeacher($request->user());
        $preferences->update($request->validated());

        return redirect()
            ->route('teacher.notifications.preferences')
            ->with('success', 'Notification preferences updated.');
    }

    public function markAsRead(Request $request, string $id)
    {
        $notification = $request->user()->unreadNotifications()->where('id', $id)->firstOrFail();
        $notification->markAsRead();

        if ($request->wantsJson()) {
            return response()->json(['success' => true]);
        }

        return back();
    }

    public function markAllAsRead(Request $request)
    {
        $request->user()->unreadNotifications->each->markAsRead();

        if ($request->wantsJson()) {
            return response()->json(['success' => true]);
        }

        return back();
    }

    public function bulkMarkRead(Request $request)
    {
        $data = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['string'],
        ]);

        $request->user()
            ->unreadNotifications()
            ->whereIn('id', $data['ids'])
            ->get()
            ->each
            ->markAsRead();

        return redirect()
            ->back()
            ->with('success', 'Selected notifications marked as read.');
    }
}
