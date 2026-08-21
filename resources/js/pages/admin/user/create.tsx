import UserForm, { type UserFormValues } from '@/components/users/UserForm';
import { type RoleOption } from '@/components/users/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type PagePropsWithFlash } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { AlertTriangle, ArrowLeft, Check, Loader2, Save, UserPlus } from 'lucide-react';
import { useEffect } from 'react';
import { Bounce, ToastContainer, toast } from 'react-toastify';

interface CreateUserPageProps {
    roles: RoleOption[];
    statusOptions: string[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'User Management', href: '/admin/user-management/users' },
    { title: 'Create User', href: '/admin/user-management/users/create' },
];

function formatStatusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function CreateUserPage({ roles, statusOptions }: CreateUserPageProps) {
    const { flash } = usePage().props as PagePropsWithFlash;
    const defaultRole = roles.find((role) => role.name.toLowerCase() === 'user')?.name ?? roles[0]?.name ?? '';

    const { data, setData, post, processing, errors } = useForm<UserFormValues>({
        name: '',
        email: '',
        staff_id: '',
        roles: defaultRole ? [defaultRole] : [],
        status: 'active',
        send_welcome_email: true,
    });

    const errorList = Object.values(errors).filter(Boolean);

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, { theme: 'dark', transition: Bounce });
        }
        if (flash?.error) {
            toast.error(flash.error, { theme: 'dark', transition: Bounce });
        }
    }, [flash?.success, flash?.error]);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        post(route('admin.user-management.users.store'), {
            onError: (formErrors) => {
                const firstError = Object.values(formErrors)[0];
                toast.error(firstError || 'Please review the highlighted fields and try again.', {
                    theme: 'dark',
                    transition: Bounce,
                });
            },
        });
    };

    const actions = (
        <>
            <Button type="submit" disabled={processing} className="h-10 w-full">
                {processing ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {processing ? 'Creating…' : 'Create user'}
            </Button>
            <Button asChild type="button" variant="outline" className="w-full">
                <Link href={route('admin.user-management.users.index')}>Cancel</Link>
            </Button>
        </>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create User" />
            <ToastContainer />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full border border-sidebar-border/70 bg-white px-3 py-1 text-xs font-medium text-sidebar-foreground/70 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                            <UserPlus className="size-3.5 text-primary" />
                            Administration
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-sidebar-foreground md:text-3xl">Create admin user</h1>
                        <p className="max-w-2xl text-sm text-sidebar-foreground/60">
                            A secure temporary password will be generated automatically. The user must change it on first login.
                        </p>
                    </div>
                    <Button asChild variant="outline" className="shrink-0">
                        <Link href={route('admin.user-management.users.index')}>
                            <ArrowLeft className="size-4" />
                            Back to users
                        </Link>
                    </Button>
                </div>

                {errorList.length > 0 && (
                    <Alert
                        variant="destructive"
                        className="border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100"
                    >
                        <AlertTriangle />
                        <AlertTitle>Please fix the highlighted fields</AlertTitle>
                        <AlertDescription>{errorList[0]}</AlertDescription>
                    </Alert>
                )}

                <UserForm
                    mode="create"
                    data={data}
                    errors={errors}
                    processing={processing}
                    roles={roles}
                    statusOptions={statusOptions}
                    onChange={setData}
                    onSubmit={handleSubmit}
                    showActions={false}
                    sidebar={
                        <>
                            <Card className="border-primary/20 bg-primary/5 shadow-sm dark:border-primary/20 dark:bg-primary/10">
                                <CardHeader>
                                    <CardTitle className="text-base">Review before creating</CardTitle>
                                    <CardDescription>Confirm identity, access, and notification settings.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <SummaryRow label="Name" value={data.name.trim() || 'Not entered'} />
                                    <SummaryRow label="Email" value={data.email.trim() || 'Not entered'} />
                                    <SummaryRow label="Staff ID" value={data.staff_id.trim() || 'Not entered'} />
                                    <SummaryRow label="Status" value={formatStatusLabel(data.status)} />
                                    <SummaryRow
                                        label="Welcome email"
                                        value={data.send_welcome_email ? 'Will be sent' : 'Do not send'}
                                    />
                                    <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground">Roles</p>
                                        {data.roles.length > 0 ? (
                                            <ul className="space-y-1.5 rounded-xl border border-primary/15 bg-white/70 p-3 text-xs dark:bg-sidebar-accent/60">
                                                {data.roles.map((role) => (
                                                    <li key={role} className="flex items-center gap-2 font-medium">
                                                        <Check className="size-3.5 text-primary" />
                                                        {role}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="rounded-xl border border-dashed border-primary/20 px-3 py-4 text-center text-xs text-muted-foreground">
                                                Select at least one role.
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="hidden border-sidebar-border/70 bg-white shadow-sm xl:block dark:border-sidebar-border dark:bg-sidebar-accent">
                                <CardContent className="flex flex-col gap-3 pt-6">{actions}</CardContent>
                            </Card>
                        </>
                    }
                    mobileActions={
                        <div className="flex flex-col-reverse gap-2 border-t border-sidebar-border/70 pt-4 sm:flex-row sm:justify-end">
                            <Button asChild type="button" variant="outline" className="sm:min-w-28">
                                <Link href={route('admin.user-management.users.index')}>Cancel</Link>
                            </Button>
                            <Button type="submit" disabled={processing} className="sm:min-w-44">
                                {processing ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                                {processing ? 'Creating…' : 'Create user'}
                            </Button>
                        </div>
                    }
                />
            </div>
        </AppLayout>
    );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="max-w-[62%] text-right font-medium text-sidebar-foreground">{value}</span>
        </div>
    );
}
