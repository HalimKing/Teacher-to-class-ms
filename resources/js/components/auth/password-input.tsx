import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { type ComponentProps, type ReactNode, useState } from 'react';

interface PasswordInputProps extends Omit<ComponentProps<'input'>, 'type'> {
    id: string;
    label?: string;
    error?: string;
    labelAction?: ReactNode;
    wrapperClassName?: string;
}

export default function PasswordInput({
    id,
    label = 'Password',
    error,
    labelAction,
    wrapperClassName,
    className,
    ...inputProps
}: PasswordInputProps) {
    const [visible, setVisible] = useState(false);
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
                <Lock
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                />
                <Input
                    id={id}
                    type={visible ? 'text' : 'password'}
                    aria-invalid={hasError || undefined}
                    aria-describedby={hasError ? `${id}-error` : undefined}
                    className={cn(
                        'h-11 pr-11 pl-10 transition-all duration-200',
                        hasError && 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20',
                        className,
                    )}
                    {...inputProps}
                />
                <button
                    type="button"
                    onClick={() => setVisible((current) => !current)}
                    className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    aria-pressed={visible}
                    tabIndex={-1}
                >
                    {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                </button>
            </div>
            <InputError id={`${id}-error`} message={error} role="alert" />
        </div>
    );
}
