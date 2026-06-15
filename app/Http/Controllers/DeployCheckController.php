<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DeployCheckController extends Controller
{
    /**
     * Visit GET /deploy-check after each deploy.
     * Response headers must include Set-Cookie (session + XSRF-TOKEN).
     */
    public function __invoke(Request $request): JsonResponse
    {
        $request->session()->put('_deploy_check', now()->toIso8601String());

        $dbOk = null;
        $sessionsTable = null;

        if (config('session.driver') === 'database') {
            try {
                DB::connection()->getPdo();
                $dbOk = true;
                $sessionsTable = Schema::hasTable('sessions');
            } catch (\Throwable) {
                $dbOk = false;
            }
        }

        $manifestExists = file_exists(public_path('build/manifest.json'));
        $hotFileExists = file_exists(public_path('hot'));

        return response()->json([
            'status' => 'ok',
            'message' => 'If login fails with 419, open Network tab on THIS request and confirm Set-Cookie headers exist.',
            'app_url' => config('app.url'),
            'app_env' => config('app.env'),
            'app_key_set' => (bool) config('app.key'),
            'vite_manifest_exists' => $manifestExists,
            'vite_hot_file_exists' => $hotFileExists,
            'vite_ready_for_production' => $manifestExists && ! $hotFileExists,
            'vite_fix' => $hotFileExists
                ? 'Delete public/hot on the server — it forces dev mode (port 5173).'
                : (! $manifestExists ? 'Run npm run build and upload public/build.' : null),
            'session_driver' => config('session.driver'),
            'session_cookie_name' => config('session.cookie'),
            'session_id' => $request->session()->getId(),
            'session_secure' => config('session.secure'),
            'session_domain' => config('session.domain'),
            'config_cached' => file_exists(base_path('bootstrap/cache/config.php')),
            'database_ok' => $dbOk,
            'sessions_table_exists' => $sessionsTable,
            'server_https' => $request->isSecure(),
            'host' => $request->getHost(),
        ]);
    }
}
