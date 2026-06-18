import UserForm, { type UserFormValues } from '@/components/users/UserForm';
import { type RoleOption } from '@/components/users/types';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type PagePropsWithFlash } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { ToastContainer, toast, Bounce } from 'react-toastify';

interface CreateUserPageProps {
    roles: RoleOption[];
    statusOptions: string[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'User Management', href: '/admin/user-management/users' },
    { title: 'Create User', href: '/admin/user-management/users/create' },
];

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
        post(route('admin.user-management.users.store'));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create User" />
            <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
                <div className="rounded-2xl border border-sidebar-border/70 bg-gradient-to-br from-white via-white to-primary/5 p-6 shadow-sm dark:from-sidebar-accent dark:via-sidebar-accent">
                    <p className="text-xs font-medium tracking-wide text-primary uppercase">Administration</p>
                    <h1 className="mt-2 text-3xl font-semibold text-sidebar-foreground">Create Admin User</h1>
                    <p className="mt-2 text-sm text-sidebar-foreground/70">
                        A secure temporary password will be generated automatically. The user must change it on first login.
                    </p>
                </div>

                <UserForm
                    mode="create"
                    data={data}
                    errors={errors}
                    processing={processing}
                    roles={roles}
                    statusOptions={statusOptions}
                    onChange={setData}
                    onSubmit={handleSubmit}
                />
            </div>
            <ToastContainer />
        </AppLayout>
    );
}
