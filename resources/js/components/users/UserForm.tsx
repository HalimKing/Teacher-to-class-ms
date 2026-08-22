import InputError from '@/components/input-error';
import { type RoleOption } from '@/components/users/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ArrowLeft, Check, Hash, KeyRound, Loader2, Mail, Save, Shield, User, X } from 'lucide-react';
import type { ReactNode } from 'react';

export interface UserFormValues {
    name: string;
    email: string;
    staff_id: string;
    roles: string[];
    status: string;
    send_welcome_email?: boolean;
}

interface UserFormProps {
    mode: 'create' | 'edit';
    data: UserFormValues;
    errors: Partial<Record<keyof UserFormValues | 'roles', string>>;
    processing: boolean;
    roles: RoleOption[];
    statusOptions: string[];
    onChange: <K extends keyof UserFormValues>(field: K, value: UserFormValues[K]) => void;
    onSubmit: (event: React.FormEvent) => void;
    userSummary?: {
        name: string;
        email: string;
        staff_id: string;
        created_at?: string;
        initials: string;
    };
    showActions?: boolean;
    sidebar?: ReactNode;
    mobileActions?: ReactNode;
}

const fieldClass =
    'h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50';

function formatStatusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusButtonClass(status: string, selected: boolean): string {
    if (!selected) {
        return 'border-input bg-background text-sidebar-foreground hover:bg-accent';
    }

    if (status === 'active') {
        return 'border-emerald-600 bg-emerald-600 text-white shadow-xs';
    }

    if (status === 'suspended') {
        return 'border-red-600 bg-red-600 text-white shadow-xs';
    }

    return 'border-slate-700 bg-slate-700 text-white shadow-xs';
}

export default function UserForm({
    mode,
    data,
    errors,
    processing,
    roles,
    statusOptions,
    onChange,
    onSubmit,
    userSummary,
    showActions = true,
    sidebar,
    mobileActions,
}: UserFormProps) {
    const toggleRole = (roleName: string) => {
        if (data.roles.includes(roleName)) {
            if (data.roles.length === 1) {
                return;
            }

            onChange(
                'roles',
                data.roles.filter((role) => role !== roleName),
            );
            return;
        }

        onChange('roles', [...data.roles, roleName]);
    };

    const fields = (
        <div className="space-y-6">
            {mode === 'edit' && userSummary && (
                <Card className="border-sidebar-border/70 bg-gradient-to-br from-primary/10 via-white to-primary/5 shadow-sm dark:from-sidebar-accent dark:via-sidebar-accent">
                    <CardContent className="flex min-w-0 items-center gap-4 pt-6">
                        <div className="flex size-14 items-center justify-center rounded-xl bg-primary/15 text-lg font-semibold text-primary">
                            {userSummary.initials}
                        </div>
                        <div className="min-w-0">
                            <h2 className="truncate text-xl font-semibold text-sidebar-foreground">{userSummary.name}</h2>
                            <p className="truncate text-sm text-sidebar-foreground/60">{userSummary.email}</p>
                            <p className="mt-1 text-xs text-sidebar-foreground/50">
                                Staff ID: {userSummary.staff_id}
                                {userSummary.created_at ? ` · Created ${userSummary.created_at}` : ''}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <User className="size-4 text-sidebar-foreground/50" />
                        Account details
                    </CardTitle>
                    <CardDescription>Identity used for login, audit logs, and administrator directories.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField label="Full name" htmlFor="name" error={errors.name} required hint="As it should appear to other admins">
                        <Input
                            id="name"
                            value={data.name}
                            onChange={(event) => onChange('name', event.target.value)}
                            className={fieldClass}
                            placeholder="e.g. Ama Mensah"
                            autoComplete="name"
                            required
                            aria-invalid={Boolean(errors.name)}
                        />
                    </FormField>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField label="Email address" htmlFor="email" error={errors.email} required hint="Used to sign in">
                            <div className="relative">
                                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    value={data.email}
                                    onChange={(event) => onChange('email', event.target.value)}
                                    className={cn(fieldClass, 'pl-9')}
                                    placeholder="name@ubids.edu.gh"
                                    autoComplete="email"
                                    required
                                    aria-invalid={Boolean(errors.email)}
                                />
                            </div>
                        </FormField>

                        <FormField label="Staff ID" htmlFor="staff_id" error={errors.staff_id} required hint="Must be unique">
                            <div className="relative">
                                <Hash className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="staff_id"
                                    value={data.staff_id}
                                    onChange={(event) => onChange('staff_id', event.target.value)}
                                    className={cn(fieldClass, 'pl-9')}
                                    placeholder="e.g. ADM001"
                                    autoComplete="off"
                                    required
                                    aria-invalid={Boolean(errors.staff_id)}
                                />
                            </div>
                        </FormField>
                    </div>

                    <FormField label="Account status" htmlFor="status" error={errors.status} required>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="Account status">
                            {statusOptions.map((status) => {
                                const selected = data.status === status;
                                return (
                                    <button
                                        key={status}
                                        type="button"
                                        onClick={() => onChange('status', status)}
                                        className={cn(
                                            'flex min-h-11 items-center justify-center rounded-md border text-sm font-medium transition-colors',
                                            statusButtonClass(status, selected),
                                        )}
                                        aria-pressed={selected}
                                    >
                                        {formatStatusLabel(status)}
                                    </button>
                                );
                            })}
                        </div>
                    </FormField>
                </CardContent>
            </Card>

            <Card className="border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Shield className="size-4 text-sidebar-foreground/50" />
                                Roles and access
                            </CardTitle>
                            <CardDescription className="mt-1.5">Assign at least one role. Permissions come from the selected roles.</CardDescription>
                        </div>
                        <Badge variant="secondary" className="w-fit">
                            {data.roles.length} selected
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {data.roles.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {data.roles.map((role) => (
                                <button
                                    key={role}
                                    type="button"
                                    onClick={() => toggleRole(role)}
                                    className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
                                    aria-label={data.roles.length > 1 ? `Remove ${role} role` : `${role} role`}
                                >
                                    {role}
                                    {data.roles.length > 1 && <X className="size-3" />}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Available roles">
                        {roles.map((role) => {
                            const selected = data.roles.includes(role.name);

                            return (
                                <button
                                    key={role.id}
                                    type="button"
                                    onClick={() => toggleRole(role.name)}
                                    className={cn(
                                        'flex min-h-11 min-w-0 items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors',
                                        selected
                                            ? 'border-primary bg-primary/5 text-sidebar-foreground ring-1 ring-primary/20'
                                            : 'border-sidebar-border/70 text-sidebar-foreground/80 hover:border-primary/40 hover:bg-muted/40',
                                    )}
                                    aria-pressed={selected}
                                >
                                    <span
                                        className={cn(
                                            'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border',
                                            selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background',
                                        )}
                                    >
                                        {selected ? <Check className="size-3" /> : null}
                                    </span>
                                    <span className="font-medium">{role.name}</span>
                                </button>
                            );
                        })}
                    </div>
                    <InputError message={errors.roles} />
                </CardContent>
            </Card>

            {mode === 'create' && (
                <Card className="border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <KeyRound className="size-4 text-sidebar-foreground/50" />
                            Credentials and notification
                        </CardTitle>
                        <CardDescription>A temporary password is generated automatically. The user must change it at first login.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert className="border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-100">
                            <KeyRound />
                            <AlertTitle>Password is created for you</AlertTitle>
                            <AlertDescription>
                                After saving, you can copy the temporary password from the users list. Share it only through a secure channel.
                            </AlertDescription>
                        </Alert>

                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-sidebar-border/70 p-4 text-sm dark:border-sidebar-border">
                            <Checkbox
                                checked={Boolean(data.send_welcome_email)}
                                onCheckedChange={(checked) => onChange('send_welcome_email', checked === true)}
                                className="mt-0.5"
                                aria-label="Send welcome email"
                            />
                            <span>
                                <span className="font-medium text-sidebar-foreground">Send welcome email</span>
                                <span className="mt-1 block text-xs text-muted-foreground">Optional. Notifies the user that an account was created.</span>
                            </span>
                        </label>
                    </CardContent>
                </Card>
            )}
        </div>
    );

    return (
        <form onSubmit={onSubmit} className="flex min-w-0 flex-col gap-6">
            {sidebar ? (
                <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.85fr)]">
                    {fields}
                    <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">{sidebar}</aside>
                </div>
            ) : (
                fields
            )}

            {showActions && (
                <div className="flex flex-col-reverse gap-2 border-t border-sidebar-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <Button type="button" variant="outline" className="h-10" asChild>
                        <Link href={route('admin.user-management.users.index')}>
                            <ArrowLeft className="size-4" />
                            {mode === 'create' ? 'Cancel' : 'Back to users'}
                        </Link>
                    </Button>
                    <Button type="submit" disabled={processing} className="h-10 sm:min-w-44">
                        {processing ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                        {processing ? (mode === 'create' ? 'Creating…' : 'Saving…') : mode === 'create' ? 'Create user' : 'Save changes'}
                    </Button>
                </div>
            )}

            {mobileActions ? <div className="xl:hidden">{mobileActions}</div> : null}
        </form>
    );
}

function FormField({
    label,
    htmlFor,
    error,
    hint,
    required,
    children,
}: {
    label: string;
    htmlFor: string;
    error?: string;
    hint?: string;
    required?: boolean;
    children: ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <Label htmlFor={htmlFor}>
                    {label}
                    {required ? <span className="text-destructive"> *</span> : null}
                </Label>
                {hint && !error ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
            </div>
            {children}
            <InputError message={error} className="text-xs" />
        </div>
    );
}
