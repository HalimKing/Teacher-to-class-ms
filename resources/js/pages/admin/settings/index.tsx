import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { Bell, Building2, Clock, Loader2, MapPin, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

type SettingEntry = { key: string; value: unknown; type: string; masked?: boolean };
type GroupedSettings = Record<string, Record<string, SettingEntry>>;

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'System Settings', href: '/admin/settings-reports' },
];

const TAB_GROUPS = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'map', label: 'Map & Location', icon: MapPin },
    { id: 'notifications', label: 'Notifications & Logs', icon: Bell },
] as const;

export default function AdminSystemSettingsPage() {
    const { settings: initialSettings, flash } = usePage<{ settings: GroupedSettings; flash?: { success?: string } }>().props;
    const [activeTab, setActiveTab] = useState<string>('general');

    const groupSettings = initialSettings?.[activeTab] ?? {};
    const groupKeys = Object.keys(groupSettings);

    const initialSettingsObj = groupKeys.reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = groupSettings[k]?.value ?? '';
        return acc;
    }, {});

    const { data, setData, put, processing, errors } = useForm<any>({
        group: activeTab,
        settings: initialSettingsObj,
    });

    // When tab changes, sync form with that tab's settings
    useEffect(() => {
        const group = initialSettings?.[activeTab] ?? {};
        const next = Object.keys(group).reduce<Record<string, unknown>>((acc, k) => {
            acc[k] = group[k]?.value ?? '';
            return acc;
        }, {});
        setData({ group: activeTab, settings: next });
    }, [activeTab]);

    const handleChange = (key: string, value: unknown) => {
        setData((prev: any) => ({
            ...prev,
            settings: { ...(prev.settings as Record<string, unknown>), [key]: value },
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(route('admin.settings-reports.settings.update'), { preserveScroll: true });
    };

    const settingsData = (data.settings ?? {}) as Record<string, unknown>;

    const isBoolean = (key: string) => groupSettings[key]?.type === 'boolean';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="System Settings" />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-bold text-sidebar-foreground dark:text-sidebar-foreground">System Settings</h1>
                    <p className="mt-1 text-sm text-sidebar-foreground/60">Configure institution, attendance, map, and logging options.</p>
                </div>

                {flash?.success && (
                    <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
                        {flash.success}
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
                                        {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                                    </Label>
                                    {isBoolean(key) ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                id={key}
                                                type="checkbox"
                                                checked={Boolean(settingsData[key])}
                                                onChange={(e) => handleChange(key, e.target.checked)}
                                                className="h-4 w-4 rounded border-sidebar-border"
                                            />
                                            <span className="text-sm text-sidebar-foreground/70">Enable</span>
                                        </div>
                                    ) : (
                                        <Input
                                            id={key}
                                            type={
                                                key.includes('api_key')
                                                    ? 'password'
                                                    : key === 'default_campus_lat' || key === 'default_campus_lng'
                                                      ? 'number'
                                                      : 'text'
                                            }
                                            value={String(settingsData[key] ?? '')}
                                            onChange={(e) =>
                                                handleChange(
                                                    key,
                                                    key === 'gps_radius_meters' ||
                                                        key === 'late_check_in_minutes' ||
                                                        key === 'early_leave_minutes' ||
                                                        key === 'max_check_in_distance_meters'
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
