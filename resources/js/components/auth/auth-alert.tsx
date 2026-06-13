import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { type HTMLAttributes } from 'react';

type AuthAlertVariant = 'error' | 'success';

interface AuthAlertProps extends HTMLAttributes<HTMLDivElement> {
    variant?: AuthAlertVariant;
    message: string;
}

const variantStyles: Record<AuthAlertVariant, string> = {
    error: 'border-destructive/30 bg-destructive/5 text-destructive dark:bg-destructive/10',
    success: 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-400',
};

export default function AuthAlert({ variant = 'error', message, className, ...props }: AuthAlertProps) {
    const Icon = variant === 'success' ? CheckCircle2 : AlertCircle;

    return (
        <div
            role="alert"
            className={cn(
                'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm transition-all duration-300 animate-in fade-in slide-in-from-top-1',
                variantStyles[variant],
                className,
            )}
            {...props}
        >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{message}</p>
        </div>
    );
}
