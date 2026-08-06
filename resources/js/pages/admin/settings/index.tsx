import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { Bell, Building2, CheckCircle2, Clock, Eye, EyeOff, Loader2, MapPin, Save, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bounce, toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

type SettingEntry = { key: string; value: unknown; type: string; masked?: boolean; description?: string | null };
type GroupedSettings = Record<string, Record<string, SettingEntry>>;

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'Settings', href: '/admin/settings-reports/settings' },
    { title: 'System Settings', href: '/admin/settings-reports/settings' },
];

const SETTING_LABELS: Record<string, string> = {
    app_name: 'Application Name',
    app_logo: 'Application Logo',
    institution_name: 'Institution Name',
    administrator_venue_change_requests_enabled: 'Enable Administrator Venue Change Requests',
    forgot_password_enabled: 'Enable Forgot Password',
    gps_enforcement_enabled: 'GPS Enforcement Enabled',
    facial_recognition_enabled: 'Facial Recognition Enabled',
    face_enrollment_required: 'Face Enrollment Required',
    auto_mark_absent_after_end: 'Auto Mark Absent After End',
    allow_manual_override: 'Allow Manual Override',
    attendance_logs_enabled: 'Attendance Logs Enabled',
    log_gps_attempts: 'Log GPS Attempts',
    log_failed_attempts: 'Log Failed Attempts',
    validate_location_accuracy: 'Validate Location Accuracy',
};

function settingLabel(key: string): string {
    return SETTING_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const TAB_GROUPS = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'map', label: 'Map & Location', icon: MapPin },
    { id: 'notifications', label: 'Notifications & Logs', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
] as const;

export default function AdminSystemSettingsPage() {
    const { settings: initialSettings, flash, appLogoUrl } = usePage<{
        settings: GroupedSettings;
        flash?: { success?: string | null; error?: string | null };
        appLogoUrl?: string;
    }>().props;
    const [activeTab, setActiveTab] = useState<string>('general');
    const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);

    const groupSettings = initialSettings?.[activeTab] ?? {};
    const groupKeys = Object.keys(groupSettings);

    const initialSettingsObj = groupKeys.reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = groupSettings[k]?.value ?? '';
        return acc;
    }, {});

    const { data, setData, post, processing, errors, recentlySuccessful } = useForm<any>({
        group: activeTab,
        settings: initialSettingsObj,
        app_logo_file: null as File | null,
        _method: 'put',
    });

    // When tab changes, sync form with that tab's settings
    useEffect(() => {
        const group = initialSettings?.[activeTab] ?? {};
        const next = Object.keys(group).reduce<Record<string, unknown>>((acc, k) => {
            acc[k] = group[k]?.value ?? '';
            return acc;
        }, {});
        setData({ group: activeTab, settings: next, app_logo_file: null, _method: 'put' });
        setLogoPreview(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    useEffect(() => {
        if (flash?.success) {
            setSuccessMessage(flash.success);
            toast.success(flash.success, {
                position: 'top-right',
                autoClose: 4000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                theme: 'colored',
                transition: Bounce,
            });
        }

        if (flash?.error) {
            toast.error(flash.error, {
                position: 'top-right',
                autoClose: 5000,
                theme: 'colored',
                transition: Bounce,
            });
        }
    }, [flash?.success, flash?.error]);

    useEffect(() => {
        if (!successMessage) {
            return;
        }

        const timer = window.setTimeout(() => setSuccessMessage(null), 6000);
        return () => window.clearTimeout(timer);
    }, [successMessage]);

    const handleChange = (key: string, value: unknown) => {
        setData((prev: any) => ({
            ...prev,
            settings: { ...(prev.settings as Record<string, unknown>), [key]: value },
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('admin.settings-reports.settings.update'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setSuccessMessage('Settings updated successfully.');
                setLogoPreview(null);
                setData('app_logo_file', null);
            },
        });
    };

    const settingsData = (data.settings ?? {}) as Record<string, unknown>;
    const bannerMessage = successMessage || flash?.success || (recentlySuccessful ? 'Settings updated successfully.' : null);
    const currentLogoUrl = logoPreview || appLogoUrl || String(settingsData.app_logo || '/images/ubids-logo.png');

    const isBoolean = (key: string) => groupSettings[key]?.type === 'boolean';
    const isSecretField = (key: string) => key.includes('api_key');
    const isLogoField = (key: string) => key === 'app_logo';

    const toggleSecretVisibility = (key: string) => {
        setVisibleSecrets((current) => ({
            ...current,
            [key]: !current[key],
        }));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="System Settings" />
            <ToastContainer />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-bold text-sidebar-foreground dark:text-sidebar-foreground">System Settings</h1>
                    <p className="mt-1 text-sm text-sidebar-foreground/60">Configure institution, attendance, map, security, and logging options.</p>
                </div>

                {bannerMessage && (
                    <div
                        role="status"
                        className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-100"
                    >
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                        <div>
                            <p className="font-semibold">Update successful</p>
                            <p className="mt-0.5">{bannerMessage}</p>
                        </div>
                    </div>
                )}

                <div className="flex gap-2 border-b border-sidebar-border/50 pb-2">
                    {TAB_GROUPS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                                activeTab === tab.id
                                    ? 'bg-sidebar-accent text-sidebar-foreground dark:bg-sidebar-accent'
                                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50',
                            )}
                        >
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader>
                        <CardTitle className="text-lg">{TAB_GROUPS.find((t) => t.id === activeTab)?.label ?? activeTab}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <input type="hidden" name="group" value={activeTab} />
                            {groupKeys.map((key) => (
                                <div key={key} className="space-y-2">
                                    <Label htmlFor={key} className="text-sidebar-foreground/80">
                                        {settingLabel(key)}
                                    </Label>
                                    {groupSettings[key]?.description && (
                                        <p className="text-xs text-sidebar-foreground/60">{groupSettings[key].description}</p>
                                    )}
                                    {key === 'administrator_venue_change_requests_enabled' && (
                                        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-sidebar-border dark:bg-sidebar-accent dark:text-sidebar-foreground/70">
                                            This toggle only controls whether administrator staff can request venue changes.
                                            It does not remove or change the admin ability to create Venue Change Authorizations
                                            directly.
                                        </p>
                                    )}
                                    {isBoolean(key) ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                id={key}
                                                type="checkbox"
                                                checked={Boolean(settingsData[key])}
                                                onChange={(e) => handleChange(key, e.target.checked)}
                                                className="h-4 w-4 rounded border-sidebar-border"
                                            />
                                            <span className="text-sm text-sidebar-foreground/70">
                                                {Boolean(settingsData[key]) ? 'On' : 'Off'}
                                            </span>
                                        </div>
                                    ) : isLogoField(key) ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-4">
                                                <div className="flex size-20 items-center justify-center overflow-hidden rounded-xl border border-sidebar-border/60 bg-white p-2">
                                                    <img src={currentLogoUrl} alt="Current app logo" className="max-h-full max-w-full object-contain" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Input
                                                        id={key}
                                                        type="file"
                                                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0] ?? null;
                                                            setData('app_logo_file', file);
                                                            if (file) {
                                                                setLogoPreview(URL.createObjectURL(file));
                                                            } else {
                                                                setLogoPreview(null);
                                                            }
                                                        }}
                                                        className="max-w-md border-sidebar-border/50 dark:bg-sidebar-accent"
                                                    />
                                                    <p className="text-xs text-sidebar-foreground/60">
                                                        PNG, JPG, WEBP, or SVG up to 4MB. Leave empty to keep the current logo.
                                                    </p>
                                                </div>
                                            </div>
                                            <InputError message={errors.app_logo_file || errors[`settings.${key}`]} />
                                        </div>
                                    ) : isSecretField(key) ? (
                                        <div className="max-w-md">
                                            <div className="relative">
                                                <Input
                                                    id={key}
                                                    type={visibleSecrets[key] ? 'text' : 'password'}
                                                    value={String(settingsData[key] ?? '')}
                                                    onChange={(e) => handleChange(key, e.target.value)}
                                                    placeholder={groupSettings[key]?.masked ? 'Leave blank to keep current' : ''}
                                                    className="border-sidebar-border/50 pr-11 dark:bg-sidebar-accent"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSecretVisibility(key)}
                                                    className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                                                    aria-label={visibleSecrets[key] ? 'Hide API key' : 'Show API key'}
                                                    aria-pressed={Boolean(visibleSecrets[key])}
                                                >
                                                    {visibleSecrets[key] ? (
                                                        <EyeOff className="size-4" aria-hidden="true" />
                                                    ) : (
                                                        <Eye className="size-4" aria-hidden="true" />
                                                    )}
                                                </button>
                                            </div>
                                            {groupSettings[key]?.masked && (
                                                <p className="mt-1 text-xs text-sidebar-foreground/60">
                                                    Showing a masked preview. Enter a new key to replace the stored value.
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <Input
                                            id={key}
                                            type={
                                                key === 'default_campus_lat' || key === 'default_campus_lng'
                                                    ? 'number'
                                                    : 'text'
                                            }
                                            value={String(settingsData[key] ?? '')}
                                            onChange={(e) =>
                                                handleChange(
                                                    key,
                                                    key === 'gps_radius_meters' ||
                                                        key === 'late_check_in_minutes' ||
                                                        key === 'administrator_early_checkin_minutes' ||
                                                        key === 'teacher_early_checkin_minutes' ||
                                                        key === 'checkout_grace_period_minutes' ||
                                                        key === 'early_leave_minutes' ||
                                                        key === 'max_check_in_distance_meters' ||
                                                        key === 'face_match_threshold' ||
                                                        key === 'face_verification_timeout'
                                                        ? e.target.value === ''
                                                            ? ''
                                                            : Number(e.target.value)
                                                        : e.target.value,
                                                )
                                            }
                                            placeholder={groupSettings[key]?.masked ? 'Leave blank to keep current' : ''}
                                            className="max-w-md border-sidebar-border/50 dark:bg-sidebar-accent"
                                        />
                                    )}
                                    <InputError message={errors[`settings.${key}`]} />
                                </div>
                            ))}
                            <div className="flex items-center gap-4 pt-4">
                                <Button type="submit" disabled={processing} className="gap-2">
                                    {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Save changes
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
