import { SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { useCallback } from 'react';

export function useInitials() {
const page = usePage<SharedData>();
    
    const { auth } = page.props;
    const isTeacher = auth.user && auth.guard === 'teacher';


    return useCallback((fullName: string): string => {
        const names = fullName.trim().split(' ');
        
        if (names.length === 0) return '';
        if (names.length === 1) return names[0].charAt(0).toUpperCase();

        const firstInitial = names[0].charAt(0);
        const lastInitial = names[names.length - 1].charAt(0);

        return `${firstInitial}${lastInitial}`.toUpperCase();
    }, []);
}
