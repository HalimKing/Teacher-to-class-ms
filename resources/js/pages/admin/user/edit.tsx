import UserForm, { type UserFormValues } from '@/components/users/UserForm';
import { type RoleOption } from '@/components/users/types';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type PagePropsWithFlash } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { ToastContainer, toast, Bounce } from 'react-toastify';

interface EditUserPageProps {
    user: {
        id: number;
        name: string;
        email: string;
        staff_id: string;
        status?: string;
        created_at?: string;
    };
    roles: RoleOption[];
    userRoles: string[];
    statusOptions: string[];
}

export default function EditUserPage({ user, roles, userRoles, statusOptions }: EditUserPageProps) {
    const { flash } = usePage().props as PagePropsWithFlash;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/admin/dashboard' },
        { title: 'User Management', href: '/admin/user-management/users' },
        { title: `Edit ${user.name}`, href: route('admin.user-management.users.edit', user.id) },
    ];

    const { data, setData, put, processing, errors } = useForm<UserFormValues>({
        name: user.name,
        email: user.email,
        staff_id: user.staff_id,
        roles: userRoles,
        status: user.status ?? 'active',
    });

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
        put(route('admin.user-management.users.update', user.id));
    };

    const initials = user.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit ${user.name}`} />
            <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
                <div className="rounded-2xl border border-sidebar-border/70 bg-gradient-to-br from-white via-white to-primary/5 p-6 shadow-sm dark:from-sidebar-accent dark:via-sidebar-accent">
                    <p className="text-xs font-medium tracking-wide text-primary uppercase">Administration</p>
                    <h1 className="mt-2 text-3xl font-semibold text-sidebar-foreground">Edit User</h1>
                    <p className="mt-2 text-sm text-sidebar-foreground/70">Update account details, status, and assigned roles.</p>
                </div>

                <UserForm
                    mode="edit"
                    data={data}
                    errors={errors}
                    processing={processing}
                    roles={roles}
                    statusOptions={statusOptions}
                    onChange={setData}
                    onSubmit={handleSubmit}
                    userSummary={{
                        name: user.name,
                        email: user.email,
                        staff_id: user.staff_id,
                        created_at: user.created_at
                            ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                            : undefined,
                        initials,
                    }}
                />
            </div>
            <ToastContainer />
        </AppLayout>
    );
}
