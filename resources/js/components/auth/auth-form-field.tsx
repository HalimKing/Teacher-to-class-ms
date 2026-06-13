import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';
import { type ComponentProps, type ReactNode } from 'react';

interface AuthFormFieldProps extends ComponentProps<'input'> {
    id: string;
    label: string;
    icon: LucideIcon;
    error?: string;
    labelAction?: ReactNode;
    wrapperClassName?: string;
}

export default function AuthFormField({
    id,
    label,
    icon: Icon,
    error,
    labelAction,
    wrapperClassName,
    className,
    ...inputProps
}: AuthFormFieldProps) {
    const hasError = Boolean(error);

    return (
        <div className={cn('grid gap-2', wrapperClassName)}>
            <div className="flex items-center justify-between gap-2">
                <Label htmlFor={id} className="text-sm font-medium">
                    {label}
                </Label>
                {labelAction}
            </div>
            <div className="relative">
                <Icon
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                />
                <Input
                    id={id}
                    aria-invalid={hasError || undefined}
                    aria-describedby={hasError ? `${id}-error` : undefined}
                    className={cn(
                        'h-11 pl-10 transition-all duration-200',
                        hasError && 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20',
                        className,
                    )}
                    {...inputProps}
                />
            </div>
            <InputError id={`${id}-error`} message={error} role="alert" />
        </div>
    );
}
