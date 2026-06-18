import InputError from '@/components/input-error';
import { type RoleOption } from '@/components/users/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ArrowLeft, Hash, Mail, Shield, User, X } from 'lucide-react';

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
}

const fieldClass =
    'h-10 w-full rounded-lg border border-sidebar-border/70 bg-white px-3 text-sm text-sidebar-foreground shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-sidebar-accent';

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
}: UserFormProps) {
    const toggleRole = (roleName: string) => {
        if (data.roles.includes(roleName)) {
            if (data.roles.length === 1) {
                return;
            }

            onChange('roles', data.roles.filter((role) => role !== roleName));
            return;
        }

        onChange('roles', [...data.roles, roleName]);
    };

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            {mode === 'edit' && userSummary && (
                <div className="rounded-2xl border border-sidebar-border/70 bg-gradient-to-br from-primary/10 via-white to-primary/5 p-6 dark:from-sidebar-accent dark:via-sidebar-accent">
                    <div className="flex items-center gap-4">
                        <div className="flex size-14 items-center justify-center rounded-xl bg-primary/15 text-lg font-semibold text-primary">
                            {userSummary.initials}
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-sidebar-foreground">{userSummary.name}</h2>
                            <p className="text-sm text-sidebar-foreground/60">{userSummary.email}</p>
                            <p className="mt-1 text-xs text-sidebar-foreground/50">
                                Staff ID: {userSummary.staff_id}
                                {userSummary.created_at ? ` · Created ${userSummary.created_at}` : ''}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <section className="rounded-2xl border border-sidebar-border/70 bg-white p-6 shadow-sm dark:bg-sidebar-accent">
                <div className="mb-6 flex items-center gap-2">
                    <User className="size-5 text-primary" />
                    <h3 className="text-lg font-semibold text-sidebar-foreground">Account Details</h3>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input id="name" value={data.name} onChange={(event) => onChange('name', event.target.value)} className={fieldClass} />
                        <InputError message={errors.name} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <div className="relative">
                            <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-sidebar-foreground/40" />
                            <Input
                                id="email"
                                type="email"
                                value={data.email}
                                onChange={(event) => onChange('email', event.target.value)}
                                className={cn(fieldClass, 'pl-10')}
                            />
                        </div>
                        <InputError message={errors.email} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="staff_id">Staff ID</Label>
                        <div className="relative">
                            <Hash className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-sidebar-foreground/40" />
                            <Input
                                id="staff_id"
                                value={data.staff_id}
                                onChange={(event) => onChange('staff_id', event.target.value)}
                                className={cn(fieldClass, 'pl-10')}
                            />
                        </div>
                        <InputError message={errors.staff_id} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="status">Account Status</Label>
                        <select
                            id="status"
                            value={data.status}
                            onChange={(event) => onChange('status', event.target.value)}
                            className={fieldClass}
                        >
                            {statusOptions.map((status) => (
                                <option key={status} value={status}>
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                </option>
                            ))}
                        </select>
                        <InputError message={errors.status} />
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-sidebar-border/70 bg-white p-6 shadow-sm dark:bg-sidebar-accent">
                <div className="mb-6 flex items-center gap-2">
                    <Shield className="size-5 text-primary" />
                    <h3 className="text-lg font-semibold text-sidebar-foreground">Roles & Access</h3>
                </div>

                <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        {data.roles.map((role) => (
                            <button
                                key={role}
                                type="button"
                                onClick={() => toggleRole(role)}
                                className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                            >
                                {role}
                                {data.roles.length > 1 && <X className="size-3" />}
                            </button>
                        ))}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {roles.map((role) => {
                            const selected = data.roles.includes(role.name);

                            return (
                                <button
                                    key={role.id}
                                    type="button"
                                    onClick={() => toggleRole(role.name)}
                                    className={cn(
                                        'rounded-xl border px-4 py-3 text-left text-sm transition-colors',
                                        selected
                                            ? 'border-primary bg-primary/5 text-sidebar-foreground'
                                            : 'border-sidebar-border/70 text-sidebar-foreground/70 hover:border-primary/40',
                                    )}
                                >
                                    {role.name}
                                </button>
                            );
                        })}
                    </div>
                    <InputError message={errors.roles} />
                </div>
            </section>

            {mode === 'create' && (
                <section className="rounded-2xl border border-sidebar-border/70 bg-white p-6 shadow-sm dark:bg-sidebar-accent">
                    <label className="flex items-start gap-3 text-sm text-sidebar-foreground">
                        <input
                            type="checkbox"
                            checked={Boolean(data.send_welcome_email)}
                            onChange={(event) => onChange('send_welcome_email', event.target.checked)}
                            className="mt-1"
                        />
                        <span>
                            <span className="font-medium">Send welcome email</span>
                            <span className="mt-1 block text-sidebar-foreground/60">
                                Notifies the user that an account was created. Credentials are still shared securely by an administrator.
                            </span>
                        </span>
                    </label>
                </section>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <Button type="button" variant="outline" asChild>
                    <Link href={route('admin.user-management.users.index')}>
                        <ArrowLeft className="size-4" />
                        Back to Users
                    </Link>
                </Button>

                <Button type="submit" disabled={processing}>
                    {processing ? (mode === 'create' ? 'Creating...' : 'Saving...') : mode === 'create' ? 'Create User Account' : 'Save Changes'}
                </Button>
            </div>
        </form>
    );
}
