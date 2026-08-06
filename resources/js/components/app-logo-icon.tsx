import { ImgHTMLAttributes } from 'react';
import { usePage } from '@inertiajs/react';
import { type SharedData } from '@/types';
import { cn } from '@/lib/utils';

const DEFAULT_LOGO = '/images/ubids-logo.png';

export default function AppLogoIcon({ className, alt = 'App logo', ...props }: ImgHTMLAttributes<HTMLImageElement>) {
    const { app_logo, name } = usePage<SharedData>().props;
    const src = (typeof app_logo === 'string' && app_logo.trim() !== '' ? app_logo : DEFAULT_LOGO);

    return (
        <img
            src={src}
            alt={alt || name || 'UBIDS ATTENDANCE'}
            className={cn('object-contain', className)}
            {...props}
        />
    );
}
