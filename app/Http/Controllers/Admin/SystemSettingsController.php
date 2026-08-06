<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SystemSettingsUpdateRequest;
use App\Models\SystemSetting;
use App\Services\ActivityLogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin-only system settings: view and update grouped settings.
 * Permissions: admin.settings.view (read), admin.settings.edit (update).
 */
class SystemSettingsController extends Controller
{
    public function __construct(
        private ActivityLogService $activityLogService
    ) {}

    /**
     * Display system settings dashboard (all groups for UI).
     */
    public function index(Request $request): Response
    {
        // $this->authorize('viewAny', SystemSetting::class);

        $grouped = SystemSetting::getGrouped();

        // Mask sensitive keys for display (e.g. API key show only last 4 chars)
        $grouped = $this->maskSensitiveKeys($grouped);

        return Inertia::render('admin/settings/index', [
            'settings' => $grouped,
            'appLogoUrl' => SystemSetting::appLogoUrl(),
        ]);
    }

    /**
     * Update settings for a given group.
     * Sensitive keys (e.g. API key) are not overwritten when submitted empty.
     */
    public function update(SystemSettingsUpdateRequest $request): RedirectResponse
    {
        // $this->authorize('update', SystemSetting::class);

        $keyValues = $request->getSettingsArray();
        $sensitiveKeys = ['google_maps_api_key'];
        foreach ($sensitiveKeys as $key) {
            if (array_key_exists($key, $keyValues) && (string) $keyValues[$key] === '') {
                unset($keyValues[$key]);
            }
        }

        // Keep existing logo path unless a new file is uploaded.
        if (array_key_exists('app_logo', $keyValues) && !$request->hasFile('app_logo_file')) {
            unset($keyValues['app_logo']);
        }

        if ($request->hasFile('app_logo_file') && $request->validated('group') === 'general') {
            $previousLogo = SystemSetting::getValue('app_logo');
            $path = $request->file('app_logo_file')->store('branding', 'public');
            $keyValues['app_logo'] = Storage::disk('public')->url($path);

            // Normalize to app-relative path for portability.
            $keyValues['app_logo'] = '/storage/' . ltrim($path, '/');

            if (is_string($previousLogo) && str_starts_with($previousLogo, '/storage/branding/')) {
                $oldRelative = str_replace('/storage/', '', $previousLogo);
                if ($oldRelative !== '' && Storage::disk('public')->exists($oldRelative)) {
                    Storage::disk('public')->delete($oldRelative);
                }
            }
        }

        $changes = [];
        foreach ($keyValues as $key => $newValue) {
            $previous = SystemSetting::getValue($key);
            $normalizedNew = $this->normalizeForCompare($newValue, $previous);

            if ($this->valuesDiffer($previous, $normalizedNew)) {
                $changes[$key] = [
                    'previous_value' => $previous,
                    'new_value' => $normalizedNew,
                ];
            }
        }

        SystemSetting::setMany($keyValues);

        $actor = $request->user();
        $changedAt = now()->toIso8601String();

        foreach ($changes as $key => $change) {
            $this->activityLogService->logSystemSettings(
                eventType: 'setting_changed',
                description: "System setting '{$key}' changed from "
                    . $this->formatAuditValue($change['previous_value'])
                    . ' to '
                    . $this->formatAuditValue($change['new_value'])
                    . '.',
                metadata: [
                    'setting_key' => $key,
                    'previous_value' => $change['previous_value'],
                    'new_value' => $change['new_value'],
                    'changed_by' => $actor?->id,
                    'changed_by_name' => $actor?->name,
                    'changed_by_email' => $actor?->email,
                    'changed_at' => $changedAt,
                    'group' => $request->validated('group'),
                ],
            );
        }

        $this->activityLogService->logSystemSettings(
            eventType: 'settings_updated',
            description: 'System settings updated for group: ' . $request->validated('group'),
            metadata: [
                'group' => $request->validated('group'),
                'keys' => array_keys($keyValues),
                'changed_keys' => array_keys($changes),
                'changed_by' => $actor?->id,
                'changed_by_name' => $actor?->name,
                'changed_at' => $changedAt,
            ],
        );

        return redirect()->route('admin.settings-reports.settings.index')
            ->with('success', 'Settings updated successfully.');
    }

    /**
     * Mask sensitive values (e.g. google_maps_api_key) for frontend display.
     */
    private function maskSensitiveKeys(array $grouped): array
    {
        if (!empty($grouped['map']['google_maps_api_key']['value'])) {
            $v = $grouped['map']['google_maps_api_key']['value'];
            if (strlen($v) > 8) {
                $grouped['map']['google_maps_api_key']['value'] = substr($v, 0, 4) . '…' . substr($v, -4);
                $grouped['map']['google_maps_api_key']['masked'] = true;
            }
        }
        return $grouped;
    }

    private function normalizeForCompare(mixed $newValue, mixed $previous): mixed
    {
        if (is_bool($previous) || is_bool($newValue)) {
            return filter_var($newValue, FILTER_VALIDATE_BOOLEAN);
        }

        if (is_int($previous) || (is_numeric($newValue) && is_int($previous))) {
            return (int) $newValue;
        }

        if (is_float($previous) || (is_numeric($newValue) && is_float($previous))) {
            return (float) $newValue;
        }

        return $newValue;
    }

    private function valuesDiffer(mixed $previous, mixed $newValue): bool
    {
        if (is_bool($previous) || is_bool($newValue)) {
            return (bool) $previous !== (bool) $newValue;
        }

        return $previous != $newValue;
    }

    private function formatAuditValue(mixed $value): string
    {
        if (is_bool($value)) {
            return $value ? 'On' : 'Off';
        }

        if ($value === null || $value === '') {
            return '(empty)';
        }

        return (string) $value;
    }
}
