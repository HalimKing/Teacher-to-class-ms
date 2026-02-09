import {usePage} from '@inertiajs/react';


export function can(permission: string): boolean {
    const {auth} = usePage().props as {auth: {user: any, permissions: string[]}};

    // if (!auth.user) {
    //     return false;
    // }    

    return auth.permissions.includes(permission);
}