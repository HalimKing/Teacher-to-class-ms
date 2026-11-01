import { RecipientPicker, type RecipientOption } from '@/components/communication/recipient-picker';
import { type CommunicationCapabilities, type DepartmentOption, type FacultyOption, type StaffOption } from '@/components/communication/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { apiJsonRequest, getApiErrorMessage } from '@/lib/http';
import { cn } from '@/lib/utils';
import { Link, useForm } from '@inertiajs/react';
import { AlertTriangle, Bell, Building2, Check, Circle, FileText, Landmark, Loader2, PenLine, Send, Users, UsersRound } from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Bounce, toast } from 'react-toastify';

type PreviewResponse = {
    count: number;
    groups: string[];
    warning: string | null;
    large_audience: boolean;
};

type ComposeFormData = {
    subject: string;
    body: string;
    save_as_draft: boolean;
    all_faculties: boolean;
    all_departments: boolean;
    all_staff: boolean;
    faculty_ids: number[];
    department_ids: number[];
    staff_ids: number[];
};

function toggleId(ids: number[], id: number): number[] {
    return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
}

function mergeLookup<T extends { id: number }>(current: Record<number, T>, items: T[]): Record<number, T> {
    const next = { ...current };
    items.forEach((item) => {
        next[item.id] = item;
    });
    return next;
}

function AudienceToggle({
    checked,
    onCheckedChange,
    title,
    description,
    icon: Icon,
}: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    title: string;
    description: string;
    icon: typeof Users;
}) {
    return (
        <label
            className={cn(
                'flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl border p-4 transition',
                checked
                    ? 'border-indigo-300 bg-indigo-50/70 shadow-sm shadow-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/30 dark:shadow-none'
                    : 'border-sidebar-border/70 bg-background hover:border-indigo-200 hover:bg-indigo-50/30 dark:hover:border-indigo-900',
            )}
        >
            <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} className="mt-0.5" />
            <span
                className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-xl',
                    checked ? 'bg-indigo-600 text-white' : 'bg-muted text-sidebar-foreground/60',
                )}
            >
                <Icon className="size-4" />
            </span>
            <span className="min-w-0">
                <span className="block text-sm font-semibold text-sidebar-foreground">{title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-sidebar-foreground/60">{description}</span>
            </span>
        </label>
    );
}

function SectionHeader({
    step,
    icon: Icon,
    title,
    description,
    aside,
}: {
    step: string;
    icon: typeof Users;
    title: string;
    description: string;
    aside?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
                    <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-400 uppercase">Step {step}</p>
                    <h2 className="mt-0.5 text-base font-semibold text-sidebar-foreground sm:text-lg">{title}</h2>
                    <p className="mt-1 text-sm text-sidebar-foreground/60">{description}</p>
                </div>
            </div>
            {aside}
        </div>
    );
}

function ReadinessItem({ done, label, hint }: { done: boolean; label: string; hint?: string }) {
    return (
        <li className="flex items-start gap-2.5">
            {done ? (
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <Check className="size-2.5" />
                </span>
            ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-sidebar-foreground/30" />
            )}
            <span className="min-w-0">
                <span className={cn('block text-sm', done ? 'text-sidebar-foreground' : 'text-sidebar-foreground/60')}>{label}</span>
                {hint && !done && <span className="block text-xs text-sidebar-foreground/50">{hint}</span>}
            </span>
        </li>
    );
}

function AudiencePreviewDetails({
    hasAudience,
    recipientCount,
    previewing,
    previewError,
    preview,
    subjectReady,
    bodyReady,
}: {
    hasAudience: boolean;
    recipientCount: number;
    previewing: boolean;
    previewError: string | null;
    preview: PreviewResponse | null;
    subjectReady: boolean;
    bodyReady: boolean;
}) {
    const audienceReady = hasAudience && recipientCount > 0;

    return (
        <>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-400 uppercase">Summary</p>
                    <h2 className="mt-0.5 text-base font-semibold text-sidebar-foreground">Audience preview</h2>
                </div>
                {previewing && <Loader2 className="size-4 shrink-0 animate-spin text-sidebar-foreground/50" />}
            </div>

            <div className="mt-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-4 text-white">
                <p className="text-[11px] font-medium tracking-wide text-indigo-100 uppercase">Eligible staff</p>
                <div className="mt-1 flex items-end gap-2">
                    <p className="text-4xl font-semibold tracking-tight">{hasAudience ? recipientCount : 0}</p>
                    <p className="pb-1 text-sm text-indigo-100">{recipientCount === 1 ? 'recipient' : 'recipients'}</p>
                </div>
                {!hasAudience && <p className="mt-2 text-xs text-indigo-100/90">Select recipients to calculate the reach.</p>}
            </div>

            {previewError && <p className="mt-3 break-words text-sm text-rose-600">{previewError}</p>}

            {preview?.groups?.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {preview.groups.map((group) => (
                        <span
                            key={group}
                            className="max-w-full truncate rounded-full border border-sidebar-border/70 bg-muted/40 px-2.5 py-1 text-xs text-sidebar-foreground/75"
                        >
                            {group}
                        </span>
                    ))}
                </div>
            ) : null}

            {preview?.warning && (
                <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    {preview.warning}
                </p>
            )}

            <ul className="mt-5 space-y-2.5">
                <ReadinessItem done={audienceReady} label="Recipients selected" hint="Choose at least one staff member or group." />
                <ReadinessItem done={subjectReady} label="Subject added" hint="A short, clear subject line." />
                <ReadinessItem done={bodyReady} label="Message written" hint="The full text staff will receive." />
            </ul>
        </>
    );
}

export function CommunicationComposeForm({
    mode,
    storeRoute,
    previewRoute,
    staffSearchRoute,
    facultySearchRoute,
    departmentSearchRoute,
    faculties = [],
    departments = [],
    capabilities,
    cancelHref,
}: {
    mode: 'admin' | 'leader';
    storeRoute: string;
    previewRoute: string;
    staffSearchRoute: string;
    facultySearchRoute?: string;
    departmentSearchRoute?: string;
    faculties?: FacultyOption[];
    departments?: DepartmentOption[];
    capabilities: CommunicationCapabilities;
    cancelHref: string;
}) {
    const { data, setData, post, processing, errors, transform } = useForm<ComposeFormData>({
        subject: '',
        body: '',
        save_as_draft: false,
        all_faculties: false,
        all_departments: false,
        all_staff: false,
        faculty_ids: [],
        department_ids: [],
        staff_ids: [],
    });
    const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
    const [facultyOptions, setFacultyOptions] = useState<FacultyOption[]>(faculties);
    const [departmentOptions, setDepartmentOptions] = useState<DepartmentOption[]>(departments);
    const [staffLookup, setStaffLookup] = useState<Record<number, StaffOption>>({});
    const [facultyLookup, setFacultyLookup] = useState<Record<number, FacultyOption>>(
        Object.fromEntries(faculties.map((item) => [item.id, item])),
    );
    const [departmentLookup, setDepartmentLookup] = useState<Record<number, DepartmentOption>>(
        Object.fromEntries(departments.map((item) => [item.id, item])),
    );
    const [preview, setPreview] = useState<PreviewResponse | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [previewing, setPreviewing] = useState(false);
    const [loadingStaff, setLoadingStaff] = useState(true);
    const [loadingFaculties, setLoadingFaculties] = useState(false);
    const [loadingDepartments, setLoadingDepartments] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const hasAudience =
        data.all_faculties ||
        data.all_departments ||
        data.all_staff ||
        data.faculty_ids.length > 0 ||
        data.department_ids.length > 0 ||
        data.staff_ids.length > 0;

    const selectedStaff = useMemo(
        () => data.staff_ids.map((id) => staffLookup[id]).filter(Boolean),
        [data.staff_ids, staffLookup],
    );
    const selectedFaculties = useMemo(
        () => data.faculty_ids.map((id) => facultyLookup[id]).filter(Boolean),
        [data.faculty_ids, facultyLookup],
    );
    const selectedDepartments = useMemo(
        () => data.department_ids.map((id) => departmentLookup[id]).filter(Boolean),
        [data.department_ids, departmentLookup],
    );

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, []);

    useEffect(() => {
        let cancelled = false;

        const timer = window.setTimeout(async () => {
            if (!hasAudience) {
                setPreview(null);
                setPreviewError(null);
                setPreviewing(false);
                return;
            }

            setPreviewing(true);

            try {
                const result = await apiJsonRequest<PreviewResponse>(previewRoute, {
                    method: 'POST',
                    body: JSON.stringify({
                        subject: data.subject || 'Preview',
                        body: data.body || 'Preview',
                        all_faculties: data.all_faculties,
                        all_departments: data.all_departments,
                        all_staff: data.all_staff,
                        faculty_ids: data.faculty_ids,
                        department_ids: data.department_ids,
                        staff_ids: data.staff_ids,
                    }),
                });

                if (!cancelled) {
                    setPreview(result);
                    setPreviewError(null);
                }
            } catch (error) {
                if (!cancelled) {
                    setPreview(null);
                    const message = getApiErrorMessage(error, 'Unable to preview recipients.');
                    setPreviewError(message);
                    toast.error(message, { theme: 'dark', transition: Bounce });
                }
            } finally {
                if (!cancelled) {
                    setPreviewing(false);
                }
            }
        }, 400);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [
        hasAudience,
        previewRoute,
        data.subject,
        data.body,
        data.all_faculties,
        data.all_departments,
        data.all_staff,
        data.faculty_ids,
        data.department_ids,
        data.staff_ids,
    ]);

    const searchStaff = async (search: string) => {
        setLoadingStaff(true);
        try {
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            const result = await apiJsonRequest<{ data: StaffOption[] }>(`${staffSearchRoute}?${params.toString()}`);
            setStaffOptions(result.data);
            setStaffLookup((current) => mergeLookup(current, result.data));
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Unable to load staff.'), { theme: 'dark', transition: Bounce });
        } finally {
            setLoadingStaff(false);
        }
    };

    const searchFaculties = async (search: string) => {
        if (!facultySearchRoute) return;
        setLoadingFaculties(true);
        try {
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            const result = await apiJsonRequest<{ data: FacultyOption[] }>(`${facultySearchRoute}?${params.toString()}`);
            setFacultyOptions(result.data);
            setFacultyLookup((current) => mergeLookup(current, result.data));
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Unable to load faculties.'), { theme: 'dark', transition: Bounce });
        } finally {
            setLoadingFaculties(false);
        }
    };

    const searchDepartments = async (search: string) => {
        if (!departmentSearchRoute) return;
        setLoadingDepartments(true);
        try {
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            const result = await apiJsonRequest<{ data: DepartmentOption[] }>(`${departmentSearchRoute}?${params.toString()}`);
            setDepartmentOptions(result.data);
            setDepartmentLookup((current) => mergeLookup(current, result.data));
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Unable to load departments.'), { theme: 'dark', transition: Bounce });
        } finally {
            setLoadingDepartments(false);
        }
    };

    useEffect(() => {
        searchStaff('').catch(() => undefined);
        if (facultySearchRoute) {
            searchFaculties('').catch(() => undefined);
        }
        if (departmentSearchRoute) {
            searchDepartments('').catch(() => undefined);
        }
        // Load the initial option lists once for the current search endpoints.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [staffSearchRoute, facultySearchRoute, departmentSearchRoute]);

    const submit = (asDraft: boolean) => {
        transform((current) => ({ ...current, save_as_draft: asDraft }));
        post(storeRoute, {
            onError: () => {
                toast.error('Please review the highlighted fields and try again.', { theme: 'dark', transition: Bounce });
            },
        });
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();

        if (!data.subject.trim() || !data.body.trim()) {
            toast.error('Add a subject and message before sending.', { theme: 'dark', transition: Bounce });
            return;
        }

        if (!hasAudience || preview?.count === 0) {
            toast.error('Select at least one valid recipient before sending.', { theme: 'dark', transition: Bounce });
            return;
        }

        setConfirmOpen(true);
    };

    const needsStrongConfirm = data.all_faculties || data.all_departments || data.all_staff || Boolean(preview?.large_audience);
    const recipientCount = preview?.count ?? 0;
    const subjectReady = data.subject.trim().length > 0;
    const bodyReady = data.body.trim().length > 0;
    const recipientsError = (errors as Record<string, string | undefined>).recipients;

    const staffPickerItems: RecipientOption[] = staffOptions.map((item) => ({
        id: item.id,
        name: item.name,
        meta: [item.employee_id, item.department, item.faculty].filter(Boolean).join(' · '),
    }));
    const selectedStaffItems: RecipientOption[] = selectedStaff.map((item) => ({
        id: item.id,
        name: item.name,
        meta: [item.employee_id, item.department, item.faculty].filter(Boolean).join(' · '),
    }));

    const actionButtons = (
        <div className="flex flex-col gap-2">
            <Button
                type="submit"
                disabled={processing || !capabilities.can_send}
                className="min-h-11 w-full rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700"
            >
                {processing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {processing ? 'Sending...' : 'Send message'}
            </Button>
            {capabilities.can_manage_drafts && (
                <Button type="button" variant="outline" disabled={processing} className="min-h-11 w-full rounded-xl" onClick={() => submit(true)}>
                    <FileText className="size-4" />
                    Save draft
                </Button>
            )}
            <Button type="button" variant="ghost" className="min-h-11 w-full rounded-xl" asChild>
                <Link href={cancelHref}>Cancel</Link>
            </Button>
        </div>
    );

    const selectionCount = data.faculty_ids.length + data.department_ids.length + data.staff_ids.length;
    const recipientsAside = hasAudience ? (
        <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/60">
            <Check className="size-3.5" />
            {data.all_faculties || data.all_departments || data.all_staff
                ? 'Group selected'
                : `${selectionCount} selected`}
        </span>
    ) : (
        <span className="inline-flex w-fit shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium text-sidebar-foreground/60">
            Nothing selected yet
        </span>
    );

    return (
        <>
            <form onSubmit={handleSubmit} className="relative grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-6">
                <div className="min-w-0 space-y-5">
                    <section className="rounded-3xl border border-slate-200/80 bg-card p-4 shadow-sm sm:p-6 dark:border-sidebar-border">
                        <SectionHeader
                            step="1"
                            icon={UsersRound}
                            title="Recipients"
                            description={
                                mode === 'admin'
                                    ? 'Choose one or more faculties/directorates, departments, or staff members. Overlapping selections are sent once.'
                                    : `Only staff in ${capabilities.scope_label} can be selected.`
                            }
                            aside={recipientsAside}
                        />

                        <div className="mt-5 space-y-4">
                            {mode === 'admin' && (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {capabilities.can_send_all_faculties && (
                                        <AudienceToggle
                                            checked={data.all_faculties}
                                            onCheckedChange={(checked) => setData('all_faculties', checked)}
                                            title="All Faculties/Directorates"
                                            description="Reach every staff member across the institution."
                                            icon={Landmark}
                                        />
                                    )}
                                    {capabilities.can_send_all_departments && (
                                        <AudienceToggle
                                            checked={data.all_departments}
                                            onCheckedChange={(checked) => setData('all_departments', checked)}
                                            title="All Departments"
                                            description="Include staff from every department."
                                            icon={Building2}
                                        />
                                    )}
                                    {capabilities.can_send_all_staff && (
                                        <AudienceToggle
                                            checked={data.all_staff}
                                            onCheckedChange={(checked) => setData('all_staff', checked)}
                                            title="All Staff"
                                            description="Send to every eligible staff account."
                                            icon={Users}
                                        />
                                    )}
                                </div>
                            )}

                            {mode === 'leader' && capabilities.can_send_all_staff && (
                                <AudienceToggle
                                    checked={data.all_staff}
                                    onCheckedChange={(checked) => setData('all_staff', checked)}
                                    title={capabilities.all_staff_label}
                                    description="Include every eligible staff member in your assigned unit."
                                    icon={Users}
                                />
                            )}

                            {mode === 'admin' && capabilities.can_send_selected_faculties && !data.all_faculties && (
                                <RecipientPicker
                                    label="Selected Faculties/Directorates"
                                    description="Search and select one or more units."
                                    placeholder="Search faculties or directorates..."
                                    items={facultyOptions.map((item) => ({ id: item.id, name: item.name }))}
                                    selectedIds={data.faculty_ids}
                                    selectedItems={selectedFaculties.map((item) => ({ id: item.id, name: item.name }))}
                                    loading={loadingFaculties}
                                    onToggle={(id) => setData('faculty_ids', toggleId(data.faculty_ids, id))}
                                    onSearch={(value) => searchFaculties(value).catch(() => undefined)}
                                    onClear={() => setData('faculty_ids', [])}
                                />
                            )}

                            {mode === 'admin' && capabilities.can_send_selected_departments && !data.all_departments && (
                                <RecipientPicker
                                    label="Selected Departments"
                                    description="Filter by department name or parent faculty."
                                    placeholder="Search departments..."
                                    items={departmentOptions.map((item) => ({
                                        id: item.id,
                                        name: item.name,
                                        meta: item.faculty_name,
                                    }))}
                                    selectedIds={data.department_ids}
                                    selectedItems={selectedDepartments.map((item) => ({
                                        id: item.id,
                                        name: item.name,
                                        meta: item.faculty_name,
                                    }))}
                                    loading={loadingDepartments}
                                    onToggle={(id) => setData('department_ids', toggleId(data.department_ids, id))}
                                    onSearch={(value) => searchDepartments(value).catch(() => undefined)}
                                    onClear={() => setData('department_ids', [])}
                                />
                            )}

                            {capabilities.can_send_selected_staff && !data.all_staff && (
                                <RecipientPicker
                                    label="Selected Staff"
                                    description="Search by name, employee ID, department, or faculty."
                                    placeholder="Search staff by name or employee ID..."
                                    items={staffPickerItems}
                                    selectedIds={data.staff_ids}
                                    selectedItems={selectedStaffItems}
                                    loading={loadingStaff}
                                    onToggle={(id) => setData('staff_ids', toggleId(data.staff_ids, id))}
                                    onSearch={(value) => searchStaff(value).catch(() => undefined)}
                                    onClear={() => setData('staff_ids', [])}
                                />
                            )}

                            {recipientsError && (
                                <p className="flex items-center gap-1.5 text-sm text-rose-600">
                                    <AlertTriangle className="size-4 shrink-0" />
                                    {recipientsError}
                                </p>
                            )}
                        </div>
                    </section>

                    <section className="rounded-3xl border border-slate-200/80 bg-card p-4 shadow-sm sm:p-5 xl:hidden dark:border-sidebar-border">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-sm font-semibold text-white">
                                    {hasAudience ? recipientCount : 0}
                                </span>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-medium tracking-wide text-sidebar-foreground/50 uppercase">Audience</p>
                                    <p className="truncate text-sm font-semibold text-sidebar-foreground">
                                        {hasAudience ? 'Eligible staff will receive this' : 'Select recipients to preview the audience'}
                                    </p>
                                </div>
                            </div>
                            {previewing && <Loader2 className="size-4 shrink-0 animate-spin text-sidebar-foreground/50" />}
                        </div>
                        {previewError && <p className="mt-2 break-words text-sm text-rose-600">{previewError}</p>}
                        {preview?.groups?.length ? (
                            <p className="mt-2 break-words text-xs leading-5 text-sidebar-foreground/60">{preview.groups.join(' · ')}</p>
                        ) : null}
                        {preview?.warning && (
                            <p className="mt-2 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-200">
                                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                                {preview.warning}
                            </p>
                        )}
                    </section>

                    <section className="rounded-3xl border border-slate-200/80 bg-card p-4 shadow-sm sm:p-6 dark:border-sidebar-border">
                        <SectionHeader
                            step="2"
                            icon={PenLine}
                            title="Message"
                            description="Write a clear subject and the full message staff will receive."
                        />

                        <div className="mt-5 space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="communication-subject" className="text-sm font-semibold">
                                    Subject <span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    id="communication-subject"
                                    value={data.subject}
                                    onChange={(event) => setData('subject', event.target.value)}
                                    placeholder="e.g. Attendance briefing for this week"
                                    className={cn(
                                        'h-12 rounded-2xl border-slate-200 bg-background px-4 text-base shadow-sm focus-visible:border-indigo-500 focus-visible:ring-indigo-500/15 focus-visible:ring-4 md:text-sm dark:border-sidebar-border',
                                        errors.subject && 'border-rose-300 focus-visible:border-rose-500 focus-visible:ring-rose-500/10',
                                    )}
                                    aria-invalid={Boolean(errors.subject)}
                                    maxLength={255}
                                    required
                                />
                                {errors.subject && (
                                    <p className="flex items-center gap-1.5 text-sm text-rose-600">
                                        <AlertTriangle className="size-4 shrink-0" />
                                        {errors.subject}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-end justify-between gap-3">
                                    <Label htmlFor="communication-body" className="text-sm font-semibold">
                                        Message body <span className="text-rose-500">*</span>
                                    </Label>
                                    <span className="text-xs text-sidebar-foreground/50">{data.body.trim().length.toLocaleString()} characters</span>
                                </div>
                                <textarea
                                    id="communication-body"
                                    value={data.body}
                                    onChange={(event) => setData('body', event.target.value)}
                                    placeholder="Write the announcement, instruction, or update you want staff to receive..."
                                    rows={10}
                                    required
                                    aria-invalid={Boolean(errors.body)}
                                    className={cn(
                                        'placeholder:text-muted-foreground min-h-44 w-full resize-y rounded-2xl border border-slate-200 bg-background px-4 py-3 text-base leading-7 shadow-sm outline-none transition sm:min-h-64 md:text-sm dark:border-sidebar-border',
                                        'focus-visible:border-indigo-500 focus-visible:ring-4 focus-visible:ring-indigo-500/15',
                                        errors.body && 'border-rose-300 focus-visible:border-rose-500 focus-visible:ring-rose-500/10',
                                    )}
                                />
                                <p className="flex items-center gap-1.5 text-xs text-sidebar-foreground/55">
                                    <Bell className="size-3.5 shrink-0" />
                                    Staff will also receive an in-app notification.
                                </p>
                                {errors.body && (
                                    <p className="flex items-center gap-1.5 text-sm text-rose-600">
                                        <AlertTriangle className="size-4 shrink-0" />
                                        {errors.body}
                                    </p>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-slate-200/80 bg-card p-4 shadow-sm xl:hidden dark:border-sidebar-border">
                        {actionButtons}
                    </section>
                </div>

                <aside className="hidden space-y-4 xl:sticky xl:top-24 xl:block">
                    <section className="rounded-3xl border border-slate-200/80 bg-card p-5 shadow-sm dark:border-sidebar-border">
                        <AudiencePreviewDetails
                            hasAudience={hasAudience}
                            recipientCount={recipientCount}
                            previewing={previewing}
                            previewError={previewError}
                            preview={preview}
                            subjectReady={subjectReady}
                            bodyReady={bodyReady}
                        />
                        <Separator className="my-5" />
                        {actionButtons}
                    </section>
                </aside>
            </form>

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="rounded-3xl sm:max-w-md">
                    <DialogHeader>
                        <span
                            className={cn(
                                'mb-2 flex size-11 items-center justify-center rounded-2xl',
                                needsStrongConfirm
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200'
                                    : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300',
                            )}
                        >
                            {needsStrongConfirm ? <AlertTriangle className="size-5" /> : <Send className="size-5" />}
                        </span>
                        <DialogTitle>{needsStrongConfirm ? 'Confirm a large send?' : 'Send this message?'}</DialogTitle>
                        <DialogDescription>
                            {needsStrongConfirm
                                ? 'This will notify a large or institution-wide audience. Confirm the recipient list before sending.'
                                : 'Confirm the subject and recipient list before sending.'}
                        </DialogDescription>
                    </DialogHeader>
                    <dl className="divide-y divide-sidebar-border/60 rounded-2xl border border-sidebar-border/70 bg-muted/30 text-sm">
                        <div className="flex items-start justify-between gap-4 px-4 py-3">
                            <dt className="shrink-0 text-xs font-medium tracking-wide text-sidebar-foreground/55 uppercase">Subject</dt>
                            <dd className="min-w-0 text-right font-medium break-words text-sidebar-foreground">{data.subject || '—'}</dd>
                        </div>
                        <div className="flex items-start justify-between gap-4 px-4 py-3">
                            <dt className="shrink-0 text-xs font-medium tracking-wide text-sidebar-foreground/55 uppercase">Recipients</dt>
                            <dd className="text-right font-medium text-sidebar-foreground">
                                {recipientCount} {recipientCount === 1 ? 'staff member' : 'staff'}
                            </dd>
                        </div>
                        {preview?.groups?.length ? (
                            <div className="px-4 py-3">
                                <dt className="text-xs font-medium tracking-wide text-sidebar-foreground/55 uppercase">Audience</dt>
                                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                                    {preview.groups.map((group) => (
                                        <span
                                            key={group}
                                            className="max-w-full truncate rounded-full bg-background px-2.5 py-1 text-xs text-sidebar-foreground/75 ring-1 ring-sidebar-border/70"
                                        >
                                            {group}
                                        </span>
                                    ))}
                                </dd>
                            </div>
                        ) : null}
                    </dl>
                    <DialogFooter>
                        <Button type="button" variant="outline" className="min-h-11 w-full rounded-xl sm:w-auto" onClick={() => setConfirmOpen(false)}>
                            Review message
                        </Button>
                        <Button
                            type="button"
                            disabled={processing}
                            className="min-h-11 w-full rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 sm:w-auto"
                            onClick={() => {
                                setConfirmOpen(false);
                                submit(false);
                            }}
                        >
                            <Send className="size-4" />
                            Confirm send
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
