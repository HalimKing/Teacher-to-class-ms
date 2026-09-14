import DeleteUser from '@/components/delete-user';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem, type SharedData, type User } from '@/types';
import { Transition } from '@headlessui/react';
import { Form, Head, usePage } from '@inertiajs/react';
import { BadgeCheck, Building2, CalendarDays, Check, Eye, Lock, Mail, Phone, ShieldAlert, UserCircle } from 'lucide-react';

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

function ProfileField({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value?: string | null }) {
    return (
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-sidebar-border dark:bg-sidebar-accent/40">
            <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 dark:bg-sidebar-accent dark:text-sidebar-foreground/50">
                    <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                    <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-sidebar-foreground/50">{label}</p>
                    <p className="mt-1 text-sm font-medium break-words text-slate-900 dark:text-sidebar-foreground">{value?.trim() || '—'}</p>
                </div>
            </div>
        </div>
    );
}

function HeroStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
            <p className="text-[11px] font-medium tracking-wide text-white/70 uppercase">{label}</p>
            <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
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
    const memberSince = user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : '—';
    const departmentName = String((user.department as { name?: string } | undefined)?.name ?? user.department ?? '');

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Profile settings" />

            <SettingsLayout>
                <section className="overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm shadow-sky-100/70 dark:border-sky-900/40 dark:bg-card dark:shadow-none">
                    <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-slate-800 px-4 py-5 text-white sm:px-6 sm:py-6">
                        <div className="flex flex-col gap-5">
                            <div className="flex items-start gap-4">
                                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-lg font-semibold ring-1 ring-white/20 sm:size-16 sm:text-xl">
                                    {initials}
                                </div>
                                <div className="min-w-0">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ring-1 ring-white/20">
                                        {getRoleLabel(auth.guard, user)}
                                    </span>
                                    <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight sm:text-3xl">{displayName}</h2>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/90">
                                        <span className="inline-flex min-w-0 items-center gap-1.5">
                                            <Mail className="size-3.5 shrink-0" />
                                            <span className="truncate">{user.email}</span>
                                        </span>
                                        <span
                                            className={cn(
                                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                                                isVerified ? 'bg-emerald-400/20 text-emerald-50' : 'bg-amber-400/25 text-amber-50',
                                            )}
                                        >
                                            {isVerified ? <BadgeCheck className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
                                            {isVerified ? 'Verified' : 'Unverified'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                                <HeroStat label="Account type" value={getRoleLabel(auth.guard, user)} />
                                <HeroStat label="Email status" value={isVerified ? 'Verified address' : 'Verification pending'} />
                                <HeroStat
                                    label={isTeacher && user.employee_id ? 'Staff ID' : 'Member since'}
                                    value={isTeacher && user.employee_id ? String(user.employee_id) : memberSince}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6 dark:border-sidebar-border dark:bg-card">
                    <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200">
                            {canEditProfile ? <UserCircle className="size-5" /> : <Eye className="size-5" />}
                        </span>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-sidebar-foreground">Profile information</h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-sidebar-foreground/60">
                                {canEditProfile
                                    ? 'Update your personal details and contact email address.'
                                    : 'Your profile details are managed by the administration and are shown here for reference only.'}
                            </p>
                        </div>
                    </div>

                    {!canEditProfile && (
                        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-sidebar-border dark:bg-sidebar-accent/40 dark:text-sidebar-foreground/80">
                            <Lock className="mt-0.5 size-4 shrink-0" />
                            <p>
                                Lecturers and administrators cannot edit profile information from this page. Contact your system administrator if any
                                details need to be updated.
                            </p>
                        </div>
                    )}

                    {canEditProfile ? (
                        <Form
                            method="patch"
                            action={route('profile.update')}
                            options={{
                                preserveScroll: true,
                            }}
                            className="mt-6 space-y-5"
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
                                            className="h-11 rounded-xl"
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
                                            className="h-11 rounded-xl"
                                        />
                                        <InputError message={errors.email} />
                                    </div>

                                    {mustVerifyEmail && !isVerified && status === 'verification-link-sent' && (
                                        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
                                            A new verification link has been sent to your email address.
                                        </p>
                                    )}

                                    <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-sidebar-border">
                                        <p className="text-sm text-slate-500 dark:text-sidebar-foreground/60">
                                            Changing your email may require verification before it takes effect.
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <Transition
                                                show={recentlySuccessful}
                                                enter="transition ease-in-out"
                                                enterFrom="opacity-0"
                                                leave="transition ease-in-out"
                                                leaveTo="opacity-0"
                                            >
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                                                    <Check className="size-3.5" />
                                                    Saved
                                                </span>
                                            </Transition>
                                            <Button disabled={processing} className="h-11 min-w-32 rounded-xl">
                                                {processing ? 'Saving…' : 'Save changes'}
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </Form>
                    ) : (
                        <div className="mt-6 space-y-3">
                            {isTeacher ? (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <ProfileField icon={UserCircle} label="First name" value={user.first_name} />
                                    <ProfileField icon={UserCircle} label="Last name" value={user.last_name} />
                                </div>
                            ) : (
                                <ProfileField icon={UserCircle} label="Full name" value={user.name} />
                            )}

                            <ProfileField icon={Mail} label="Email address" value={user.email} />

                            {isTeacher && user.phone ? <ProfileField icon={Phone} label="Phone" value={String(user.phone)} /> : null}
                            {isTeacher && departmentName ? <ProfileField icon={Building2} label="Department" value={departmentName} /> : null}
                            <ProfileField icon={CalendarDays} label="Member since" value={memberSince} />

                            {mustVerifyEmail && !isVerified ? (
                                <p className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                                    <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                                    Your email address is not verified. Please contact the administration for assistance.
                                </p>
                            ) : null}
                        </div>
                    )}
                </section>

                {auth.guard === 'admin' ? (
                    <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6 dark:border-sidebar-border dark:bg-card">
                        <DeleteUser />
                    </section>
                ) : null}
            </SettingsLayout>
        </AppLayout>
    );
}
