import { usePage } from '@inertiajs/react';
import { useCallback } from 'react';

type PageAuth = {
    permissions?: unknown;
};

const EMPTY_PERMISSIONS: string[] = [];

function getPermissions(auth: PageAuth | undefined): string[] {
    return Array.isArray(auth?.permissions) ? (auth.permissions as string[]) : EMPTY_PERMISSIONS;
}

export function hasPermission(permissions: unknown, permission?: string | null): boolean {
    if (!permission || !Array.isArray(permissions)) {
        return false;
    }

    return permissions.includes(permission);
}

/** Call once at the top of a component, then use the returned function in loops or memos. */
export function useCan(): (permission?: string | null) => boolean {
    const props = usePage().props as { auth?: PageAuth };
    const permissions = getPermissions(props?.auth);

    return useCallback(
        (permission?: string | null) => hasPermission(permissions, permission),
        [permissions],
    );
}

/** Safe only when called unconditionally at the top of a React function. */
export function can(permission: string): boolean {
    const props = usePage().props as { auth?: PageAuth };

    return hasPermission(getPermissions(props?.auth), permission);
}
