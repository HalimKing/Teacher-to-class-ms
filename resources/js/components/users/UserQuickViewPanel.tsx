import { type UserListItem, type UserQuickViewData } from '@/components/users/types';
import { Button } from '@/components/ui/button';
import { can } from '@/lib/can';
import { Link } from '@inertiajs/react';
import { Activity, Key, Loader2, ShieldCheck, User, X } from 'lucide-react';

interface UserQuickViewPanelProps {
    open: boolean;
    loading: boolean;
    user: UserListItem | null;
    data: UserQuickViewData | null;
    onClose: () => void;
    onResetPassword: (user: UserListItem) => void;
}

export default function UserQuickViewPanel({ open, loading, user, data, onClose, onResetPassword }: UserQuickViewPanelProps) {
    if (!open || !user) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-label="Close quick view" />
            <aside className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-sidebar-accent">
                <div className="flex items-start justify-between border-b border-sidebar-border/60 p-6">
                    <div className="flex items-start gap-4">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-base font-semibold text-primary">
                            {user.initials}
                        </div>
                        <div>
                            <p className="text-xs font-medium tracking-wide text-primary uppercase">Admin User</p>
                            <h2 className="mt-1 text-2xl font-semibold text-sidebar-foreground">{user.name}</h2>
                            <p className="text-sm text-sidebar-foreground/60">{user.staff_id}</p>
                        </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={onClose}>
                        <X className="size-4" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading || !data ? (
                        <div className="flex h-40 items-center justify-center text-sidebar-foreground/60">
                            <Loader2 className="size-5 animate-spin" />
                            <span className="ml-2 text-sm">Loading user details...</span>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <section className="rounded-xl border border-sidebar-border/60 p-4">
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-sidebar-foreground">
                                    <User className="size-4" />
                                    Profile
                                </h3>
                                <dl className="grid gap-3 text-sm">
                                    <div><dt className="text-sidebar-foreground/50">Email</dt><dd className="font-medium">{data.profile.email}</dd></div>
                                    <div><dt className="text-sidebar-foreground/50">Status</dt><dd className="font-medium capitalize">{data.profile.status}</dd></div>
                                    <div><dt className="text-sidebar-foreground/50">Created</dt><dd className="font-medium">{data.profile.created_at || '—'}</dd></div>
                                    <div><dt className="text-sidebar-foreground/50">Last Login</dt><dd className="font-medium">{data.profile.last_login_at || 'Never'}</dd></div>
                                </dl>
                            </section>

                            <section className="rounded-xl border border-sidebar-border/60 p-4">
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-sidebar-foreground">
                                    <ShieldCheck className="size-4" />
                                    Security
                                </h3>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="rounded-lg bg-muted/40 p-3"><p className="text-sidebar-foreground/50">Password</p><p className="font-semibold">{data.security.password_status}</p></div>
                                    <div className="rounded-lg bg-muted/40 p-3"><p className="text-sidebar-foreground/50">Sessions</p><p className="font-semibold">{data.security.active_sessions}</p></div>
                                    <div className="rounded-lg bg-muted/40 p-3"><p className="text-sidebar-foreground/50">Locked</p><p className="font-semibold">{data.security.locked ? 'Yes' : 'No'}</p></div>
                                    <div className="rounded-lg bg-muted/40 p-3"><p className="text-sidebar-foreground/50">Reset Required</p><p className="font-semibold">{data.security.must_change_password ? 'Yes' : 'No'}</p></div>
                                </div>
                                {data.security.password_reset_history.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        <p className="text-xs font-semibold tracking-wide text-sidebar-foreground/50 uppercase">Recent Resets</p>
                                        {data.security.password_reset_history.map((entry, index) => (
                                            <div key={`${entry.created_at}-${index}`} className="rounded-lg border border-sidebar-border/50 px-3 py-2 text-xs">
                                                {entry.created_at} · {entry.method}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            <section className="rounded-xl border border-sidebar-border/60 p-4">
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-sidebar-foreground">
                                    <Key className="size-4" />
                                    Roles & Permissions
                                </h3>
                                <div className="mb-3 flex flex-wrap gap-2">
                                    {data.permissions.roles.map((role) => (
                                        <span key={role} className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                                            {role}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-xs text-sidebar-foreground/50">Showing up to 20 effective permissions</p>
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {data.permissions.permissions.map((permission) => (
                                        <span key={permission} className="rounded bg-muted px-2 py-1 text-[11px] text-sidebar-foreground/70">
                                            {permission}
                                        </span>
                                    ))}
                                </div>
                            </section>

                            <section className="rounded-xl border border-sidebar-border/60 p-4">
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-sidebar-foreground">
                                    <Activity className="size-4" />
                                    Recent Activity
                                </h3>
                                <div className="space-y-2">
                                    {data.activity.length ? (
                                        data.activity.map((entry, index) => (
                                            <div key={`${entry.created_at}-${index}`} className="rounded-lg border border-sidebar-border/50 px-3 py-2 text-sm">
                                                <p className="font-medium">{entry.description}</p>
                                                <p className="text-xs text-sidebar-foreground/50">{entry.created_at}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-sidebar-foreground/50">No recent activity recorded.</p>
                                    )}
                                </div>
                            </section>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 border-t border-sidebar-border/60 p-4">
                    {can('admin.user-management.users.edit') && (
                        <Button asChild variant="outline" size="sm">
                            <Link href={route('admin.user-management.users.edit', user.id)}>Edit User</Link>
                        </Button>
                    )}
                    {can('admin.user-management.users.reset-password') && (
                        <Button type="button" size="sm" onClick={() => onResetPassword(user)}>
                            Reset Password
                        </Button>
                    )}
                </div>
            </aside>
        </div>
    );
}
