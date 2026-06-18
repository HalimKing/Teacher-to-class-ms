import DeleteUser from '@/components/delete-user';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { type BreadcrumbItem, type SharedData, type User } from '@/types';
import { Transition } from '@headlessui/react';
import { Form, Head, usePage } from '@inertiajs/react';
import { BadgeCheck, Eye, Lock, Mail, UserCircle } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Profile settings',
        href: '/settings/profile',
    },
];

function getDisplayName(user: User, guard: string | null) {
    if (guard === 'teacher') {
        const parts = [user.title, user.first_name, user.last_name].filter(Boolean);
        return parts.join(' ').trim() || user.name || 'Account';
    }

    return user.name || 'Account';
}

function getInitials(user: User, guard: string | null) {
    if (guard === 'teacher' && user.first_name) {
        return `${user.first_name.charAt(0)}${user.last_name?.charAt(0) ?? ''}`.toUpperCase();
    }

    return (
        user.name
            ?.split(' ')
            .filter(Boolean)
            .map((part) => part.charAt(0))
            .join('')
            .slice(0, 2)
            .toUpperCase() || 'U'
    );
}

function getRoleLabel(guard: string | null, user: User) {
    if (guard === 'teacher') {
        return user.staff_type === 'administrator' ? 'Administrator' : 'Lecturer';
    }

    if (guard === 'admin') {
        return 'Administrator';
    }

    return 'User';
}

function ProfileField({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="rounded-xl border border-sidebar-border/60 bg-slate-50/80 px-4 py-3 dark:bg-sidebar/40">
            <p className="text-xs font-medium tracking-wide text-sidebar-foreground/50 uppercase">{label}</p>
            <p className="mt-1 text-sm font-medium text-sidebar-foreground">{value?.trim() || '—'}</p>
        </div>
    );
}

interface ProfilePageProps {
    mustVerifyEmail: boolean;
    status?: string;
    canEditProfile: boolean;
}

export default function Profile({ mustVerifyEmail, status, canEditProfile }: ProfilePageProps) {
    const { auth } = usePage<SharedData>().props;
    const user = auth.user;
    const isTeacher = auth.guard === 'teacher';
    const displayName = getDisplayName(user, auth.guard);
    const initials = getInitials(user, auth.guard);
    const isVerified = Boolean(user.email_verified_at);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Profile settings" />

            <SettingsLayout>
                <div className="space-y-6">
                    <div className="overflow-hidden rounded-2xl border border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 py-6 sm:px-8">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground shadow-sm">
                                        {initials}
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium tracking-wide text-sidebar-foreground/60 uppercase">
                                            {getRoleLabel(auth.guard, user)}
                                        </p>
                                        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-sidebar-foreground">{displayName}</h2>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-sidebar-foreground/70">
                                            <span className="inline-flex items-center gap-1.5">
                                                <Mail className="size-3.5" />
                                                {user.email}
                                            </span>
                                            {isVerified ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                                    <BadgeCheck className="size-3.5" />
                                                    Verified
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                                    Unverified
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {isTeacher && user.employee_id ? (
                                    <div className="rounded-xl border border-sidebar-border/60 bg-white/80 px-4 py-3 text-sm dark:bg-sidebar/40">
                                        <p className="text-xs font-medium tracking-wide text-sidebar-foreground/50 uppercase">Staff ID</p>
                                        <p className="mt-1 font-semibold text-sidebar-foreground">{String(user.employee_id)}</p>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div className="grid gap-4 border-t border-sidebar-border/60 px-6 py-4 sm:grid-cols-3 sm:px-8">
                            <div>
                                <p className="text-xs font-medium tracking-wide text-sidebar-foreground/50 uppercase">Account type</p>
                                <p className="mt-1 text-sm font-medium text-sidebar-foreground">{getRoleLabel(auth.guard, user)}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium tracking-wide text-sidebar-foreground/50 uppercase">Email status</p>
                                <p className="mt-1 text-sm font-medium text-sidebar-foreground">
                                    {isVerified ? 'Verified address' : 'Verification pending'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium tracking-wide text-sidebar-foreground/50 uppercase">Member since</p>
                                <p className="mt-1 text-sm font-medium text-sidebar-foreground">
                                    {user.created_at
                                        ? new Date(user.created_at).toLocaleDateString(undefined, {
                                              month: 'long',
                                              year: 'numeric',
                                          })
                                        : '—'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-sidebar-border/70 bg-white p-6 shadow-sm sm:p-8 dark:border-sidebar-border dark:bg-sidebar-accent">
                        <div className="mb-6 flex items-start gap-3">
                            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                                {canEditProfile ? <UserCircle className="size-5" /> : <Eye className="size-5" />}
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-sidebar-foreground">Profile information</h3>
                                <p className="mt-1 text-sm text-sidebar-foreground/60">
                                    {canEditProfile
                                        ? 'Update your personal details and contact email address.'
                                        : 'Your profile details are managed by the administration and are shown here for reference only.'}
                                </p>
                            </div>
                        </div>

                        {!canEditProfile && (
                            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-sidebar-border dark:bg-sidebar/40 dark:text-sidebar-foreground/80">
                                <div className="flex items-start gap-2">
                                    <Lock className="mt-0.5 size-4 shrink-0" />
                                    <p>
                                        Lecturers and administrators cannot edit profile information from this page. Contact your
                                        system administrator if any details need to be updated.
                                    </p>
                                </div>
                            </div>
                        )}

                        {canEditProfile ? (
                            <Form
                                method="patch"
                                action={route('profile.update')}
                                options={{
                                    preserveScroll: true,
                                }}
                                className="space-y-6"
                            >
                                {({ processing, recentlySuccessful, errors }) => (
                                    <>
                                        <div className="grid gap-2">
                                            <Label htmlFor="name">Full name</Label>
                                            <Input
                                                id="name"
                                                defaultValue={user.name}
                                                name="name"
                                                required
                                                autoComplete="name"
                                                placeholder="Full name"
                                            />
                                            <InputError message={errors.name} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="email">Email address</Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                defaultValue={user.email}
                                                name="email"
                                                required
                                                autoComplete="username"
                                                placeholder="Email address"
                                            />
                                            <InputError message={errors.email} />
                                        </div>

                                        {mustVerifyEmail && !isVerified && status === 'verification-link-sent' && (
                                            <p className="text-sm font-medium text-emerald-700">
                                                A new verification link has been sent to your email address.
                                            </p>
                                        )}

                                        <div className="flex flex-col gap-3 border-t border-sidebar-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                            <p className="text-sm text-sidebar-foreground/60">
                                                Changes to your email may require verification before taking effect.
                                            </p>
                                            <div className="flex items-center gap-3">
                                                <Transition
                                                    show={recentlySuccessful}
                                                    enter="transition ease-in-out"
                                                    enterFrom="opacity-0"
                                                    leave="transition ease-in-out"
                                                    leaveTo="opacity-0"
                                                >
                                                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                                                        Saved successfully
                                                    </span>
                                                </Transition>
                                                <Button disabled={processing} className="min-w-28">
                                                    {processing ? 'Saving...' : 'Save changes'}
                                                </Button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </Form>
                        ) : (
                            <div className="space-y-4">
                                {isTeacher ? (
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <ProfileField label="First name" value={user.first_name} />
                                        <ProfileField label="Last name" value={user.last_name} />
                                    </div>
                                ) : (
                                    <ProfileField label="Full name" value={user.name} />
                                )}

                                <ProfileField label="Email address" value={user.email} />

                                {isTeacher && user.phone ? <ProfileField label="Phone" value={String(user.phone)} /> : null}
                                {isTeacher && user.department ? (
                                    <ProfileField label="Department" value={String((user.department as { name?: string })?.name ?? user.department)} />
                                ) : null}

                                {mustVerifyEmail && !isVerified ? (
                                    <p className="text-sm text-amber-800">
                                        Your email address is not verified. Please contact the administration for assistance.
                                    </p>
                                ) : null}
                            </div>
                        )}
                    </div>

                    {auth.guard === 'admin' ? (
                        <div className="rounded-2xl border border-sidebar-border/70 bg-white p-6 shadow-sm sm:p-8 dark:border-sidebar-border dark:bg-sidebar-accent">
                            <DeleteUser />
                        </div>
                    ) : null}
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
