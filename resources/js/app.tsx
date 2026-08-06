import '../css/app.css';

import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { initializeTheme } from './hooks/use-appearance';
import { syncCsrfToken } from './lib/csrf';

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

createInertiaApp({
    title: (title) => title ? `${title} - ${appName}` : appName,
    resolve: (name) => resolvePageComponent(`./pages/${name}.tsx`, import.meta.glob('./pages/**/*.tsx')),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(<App {...props} />);
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
