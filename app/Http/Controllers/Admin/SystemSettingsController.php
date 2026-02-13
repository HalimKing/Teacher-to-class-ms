<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SystemSettingsUpdateRequest;
use App\Models\SystemSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin-only system settings: view and update grouped settings.
 * Permissions: admin.settings.view (read), admin.settings.edit (update).
 */
class SystemSettingsController extends Controller
{
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
        SystemSetting::setMany($keyValues);

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
}
