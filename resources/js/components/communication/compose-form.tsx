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
import { AlertTriangle, Building2, Landmark, Loader2, Send, Users } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
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
                'flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors',
                checked
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-sidebar-border/70 bg-background hover:bg-muted/50',
            )}
        >
            <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} className="mt-0.5" />
            <Icon className="mt-0.5 size-4 shrink-0 text-sidebar-foreground/55" />
            <span>
                <span className="block text-sm font-medium text-sidebar-foreground">{title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-sidebar-foreground/60">{description}</span>
            </span>
        </label>
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

    return (
        <>
            <form onSubmit={handleSubmit} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20.5rem]">
                <div className="space-y-6">
                    <section className="rounded-2xl border border-sidebar-border/70 bg-white p-5 shadow-sm dark:bg-sidebar-accent sm:p-6">
                        <div className="mb-4">
                            <h2 className="text-base font-semibold text-sidebar-foreground">Recipients</h2>
                            <p className="mt-1 text-sm text-sidebar-foreground/60">
                                {mode === 'admin'
                                    ? 'Choose one or more faculties/directorates, departments, or staff members. Overlapping selections are sent once.'
                                    : `Only staff in ${capabilities.scope_label} can be selected.`}
                            </p>
                        </div>

                        <div className="space-y-4">
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

                            {errors.recipients && <p className="text-sm text-rose-600">{errors.recipients}</p>}
                        </div>
                    </section>

                    <section className="rounded-2xl border border-sidebar-border/70 bg-white p-5 shadow-sm dark:bg-sidebar-accent sm:p-6">
                        <div className="mb-4">
                            <h2 className="text-base font-semibold text-sidebar-foreground">Message</h2>
                            <p className="mt-1 text-sm text-sidebar-foreground/60">Write a clear subject and the full message staff will receive.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="communication-subject">Subject</Label>
                                <Input
                                    id="communication-subject"
                                    value={data.subject}
                                    onChange={(event) => setData('subject', event.target.value)}
                                    placeholder="e.g. Attendance briefing for this week"
                                    className="h-11 bg-background"
                                    aria-invalid={Boolean(errors.subject)}
                                    required
                                />
                                {errors.subject && <p className="text-sm text-rose-600">{errors.subject}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="communication-body">Message body</Label>
                                <textarea
                                    id="communication-body"
                                    value={data.body}
                                    onChange={(event) => setData('body', event.target.value)}
                                    placeholder="Write the announcement, instruction, or update you want staff to receive..."
                                    rows={12}
                                    required
                                    aria-invalid={Boolean(errors.body)}
                                    className={cn(
                                        'border-input placeholder:text-muted-foreground min-h-64 w-full rounded-md border bg-background px-3 py-3 text-sm leading-6 shadow-xs outline-none',
                                        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                                        errors.body && 'border-destructive',
                                    )}
                                />
                                <div className="flex items-center justify-between gap-3 text-xs text-sidebar-foreground/50">
                                    <span>Staff will also receive an in-app notification.</span>
                                    <span>{data.body.trim().length} characters</span>
                                </div>
                                {errors.body && <p className="text-sm text-rose-600">{errors.body}</p>}
                            </div>
                        </div>
                    </section>
                </div>

                <aside className="space-y-4 xl:sticky xl:top-24">
                    <section className="rounded-2xl border border-sidebar-border/70 bg-white p-5 shadow-sm dark:bg-sidebar-accent">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-semibold text-sidebar-foreground">Audience preview</h2>
                                <p className="mt-1 text-xs text-sidebar-foreground/60">Review the reach before you send.</p>
                            </div>
                            {previewing && <Loader2 className="size-4 animate-spin text-sidebar-foreground/50" />}
                        </div>

                        <div className="mt-4 rounded-xl bg-muted/50 px-4 py-4">
                            <p className="text-xs font-medium tracking-wide text-sidebar-foreground/55 uppercase">Eligible staff</p>
                            <p className="mt-1 text-3xl font-semibold tracking-tight text-sidebar-foreground">
                                {hasAudience ? recipientCount : 0}
                            </p>
                        </div>

                        <div className="mt-4 space-y-2 text-sm text-sidebar-foreground/70">
                            {!hasAudience && <p>Select a recipient group to calculate who will receive this message.</p>}
                            {previewError && <p className="text-rose-600">{previewError}</p>}
                            {preview?.groups?.map((group) => (
                                <p key={group} className="rounded-lg bg-muted/40 px-3 py-2 text-xs leading-5">
                                    {group}
                                </p>
                            ))}
                            {preview?.warning && (
                                <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                                    {preview.warning}
                                </p>
                            )}
                        </div>

                        <Separator className="my-5" />

                        <div className="flex flex-col gap-2">
                            <Button type="submit" disabled={processing || !capabilities.can_send} className="h-10 w-full">
                                {processing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                                {processing ? 'Sending...' : 'Send message'}
                            </Button>
                            {capabilities.can_manage_drafts && (
                                <Button type="button" variant="outline" disabled={processing} className="h-10 w-full" onClick={() => submit(true)}>
                                    Save draft
                                </Button>
                            )}
                            <Button type="button" variant="ghost" className="h-10 w-full" asChild>
                                <Link href={cancelHref}>Cancel</Link>
                            </Button>
                        </div>
                    </section>
                </aside>
            </form>

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{needsStrongConfirm ? 'Confirm a large send?' : 'Send this message?'}</DialogTitle>
                        <DialogDescription>
                            {needsStrongConfirm
                                ? 'This will notify a large or institution-wide audience. Confirm the recipient list before sending.'
                                : 'Confirm the subject and recipient list before sending.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 rounded-xl border border-sidebar-border/70 bg-muted/40 p-4 text-sm">
                        <p>
                            <span className="font-medium text-sidebar-foreground">Subject:</span>{' '}
                            <span className="text-sidebar-foreground/70">{data.subject || '—'}</span>
                        </p>
                        <p>
                            <span className="font-medium text-sidebar-foreground">Recipients:</span>{' '}
                            <span className="text-sidebar-foreground/70">{recipientCount} staff</span>
                        </p>
                        {preview?.groups?.length ? (
                            <p className="text-xs leading-5 text-sidebar-foreground/60">{preview.groups.join(' · ')}</p>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
                            Review message
                        </Button>
                        <Button
                            type="button"
                            disabled={processing}
                            onClick={() => {
                                setConfirmOpen(false);
                                submit(false);
                            }}
                        >
                            Confirm send
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
