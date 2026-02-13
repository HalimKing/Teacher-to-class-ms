import {usePage} from '@inertiajs/react';


export function can(permission: string): boolean {
    const props = usePage().props as unknown as Record<string, any>;
    const auth = props?.auth ?? { user: null, permissions: [] };

    if (!auth || !Array.isArray(auth.permissions)) return false;

    return auth.permissions.includes(permission);
}