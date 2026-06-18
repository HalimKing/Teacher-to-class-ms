import { type UserListItem } from '@/components/users/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, Copy, Eye, EyeOff, Key, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ResetPasswordModalProps {
    open: boolean;
    user: UserListItem | null;
    loading: boolean;
    onClose: () => void;
    onSubmit: (payload: {
        mode: 'generate' | 'manual';
        password?: string;
        password_confirmation?: string;
        force_change_on_login: boolean;
        send_reset_link: boolean;
    }) => Promise<{ temporary_password?: string | null } | void>;
}

export default function ResetPasswordModal({ open, user, loading, onClose, onSubmit }: ResetPasswordModalProps) {
    const [mode, setMode] = useState<'generate' | 'manual'>('generate');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [forceChange, setForceChange] = useState(true);
    const [sendResetLink, setSendResetLink] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!open) {
            setMode('generate');
            setPassword('');
            setPasswordConfirmation('');
            setForceChange(true);
            setSendResetLink(false);
            setShowPassword(false);
            setGeneratedPassword(null);
            setCopied(false);
        }
    }, [open]);

    if (!open || !user) {
        return null;
    }

    const handleSubmit = async () => {
        const result = await onSubmit({
            mode,
            password: mode === 'manual' ? password : undefined,
            password_confirmation: mode === 'manual' ? passwordConfirmation : undefined,
            force_change_on_login: forceChange,
            send_reset_link: sendResetLink,
        });

        if (result?.temporary_password) {
            setGeneratedPassword(result.temporary_password);
        }
    };

    const handleCopy = async () => {
        if (!generatedPassword) {
            return;
        }

        await navigator.clipboard.writeText(generatedPassword);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Close reset password modal" />
            <div className="relative w-full max-w-lg rounded-2xl border border-sidebar-border/70 bg-white p-6 shadow-2xl dark:bg-sidebar-accent">
                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                            <Key className="size-3.5" />
                            Password Reset
                        </div>
                        <h2 className="text-xl font-semibold text-sidebar-foreground">Reset password for {user.name}</h2>
                        <p className="mt-1 text-sm text-sidebar-foreground/60">{user.email}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={onClose}>
                        <X className="size-4" />
                    </Button>
                </div>

                {generatedPassword ? (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Temporary password generated</p>
                            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">Share this securely with the user. It will not be shown again.</p>
                            <div className="mt-3 flex items-center gap-2">
                                <code className="flex-1 rounded-lg bg-white px-3 py-2 text-sm dark:bg-sidebar-accent">{generatedPassword}</code>
                                <Button type="button" variant="outline" size="icon" onClick={handleCopy}>
                                    {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                                </Button>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <Button type="button" onClick={onClose}>Done</Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-1">
                            {(['generate', 'manual'] as const).map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => setMode(option)}
                                    className={cn(
                                        'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                        mode === option ? 'bg-white text-sidebar-foreground shadow-sm dark:bg-sidebar-accent' : 'text-sidebar-foreground/60',
                                    )}
                                >
                                    {option === 'generate' ? 'Generate Secure Password' : 'Set Manual Password'}
                                </button>
                            ))}
                        </div>

                        {mode === 'manual' && (
                            <div className="space-y-3">
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        placeholder="New password"
                                        className="h-10 w-full rounded-lg border border-sidebar-border/70 bg-white px-3 pr-10 text-sm dark:bg-sidebar-accent"
                                    />
                                    <button type="button" className="absolute top-1/2 right-3 -translate-y-1/2 text-sidebar-foreground/50" onClick={() => setShowPassword((current) => !current)}>
                                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                    </button>
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={passwordConfirmation}
                                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                                    placeholder="Confirm password"
                                    className="h-10 w-full rounded-lg border border-sidebar-border/70 bg-white px-3 text-sm dark:bg-sidebar-accent"
                                />
                            </div>
                        )}

                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={forceChange} onChange={(event) => setForceChange(event.target.checked)} />
                            Require password change on next login
                        </label>

                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={sendResetLink} onChange={(event) => setSendResetLink(event.target.checked)} />
                            Send password reset email link
                        </label>

                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                                Cancel
                            </Button>
                            <Button type="button" onClick={handleSubmit} disabled={loading}>
                                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                                Reset Password
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
