import '../css/app.css';

import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { initializeTheme } from './hooks/use-appearance';
import { ensureFreshCsrfToken, syncCsrfToken } from './lib/csrf';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

syncCsrfToken();

router.on('navigate', (event) => {
    const token = (event.detail.page.props as { csrf_token?: string }).csrf_token;
    syncCsrfToken(token);
});

document.addEventListener('inertia:success', (event) => {
    const detail = (event as CustomEvent<{ page?: { props?: { csrf_token?: string } } }>).detail;
    syncCsrfToken(detail?.page?.props?.csrf_token);
});

// After tab idle / backgrounding, refresh CSRF before the next attendance POST.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        void ensureFreshCsrfToken({ force: true }).catch(() => {
            // Ignore; the next mutating request will retry via apiJsonRequest.
        });
    }
});

createInertiaApp({
    title: (title) => title ? `${title} - ${appName}` : appName,
    resolve: (name) => resolvePageComponent(`./pages/${name}.tsx`, import.meta.glob('./pages/**/*.tsx')),
    setup({ el, App, props }) {
        const initialToken = (props.initialPage.props as { csrf_token?: string }).csrf_token;
        syncCsrfToken(initialToken);

        const root = createRoot(el);

        root.render(<App {...props} />);
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
