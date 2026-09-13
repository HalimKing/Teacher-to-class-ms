import { type CommunicationCapabilities, type DepartmentOption, type FacultyOption, type StaffOption } from '@/components/communication/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiJsonRequest, getApiErrorMessage } from '@/lib/http';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

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

function SearchablePicker<T extends { id: number; name: string }>({
    label,
    placeholder,
    items,
    selectedIds,
    onToggle,
    onSearch,
    renderMeta,
}: {
    label: string;
    placeholder: string;
    items: T[];
    selectedIds: number[];
    onToggle: (id: number) => void;
    onSearch: (value: string) => void;
    renderMeta?: (item: T) => string | null | undefined;
}) {
    const [query, setQuery] = useState('');

    return (
        <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">{label}</p>
                {selectedIds.length > 0 && (
                    <span className="text-xs text-slate-500">{selectedIds.length} selected</span>
                )}
            </div>
            <input
                value={query}
                onChange={(event) => {
                    setQuery(event.target.value);
                    onSearch(event.target.value);
                }}
                placeholder={placeholder}
                className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <div className="max-h-48 space-y-1 overflow-y-auto">
                {items.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-slate-500">No matching records.</p>
                ) : (
                    items.map((item) => (
                        <label key={item.id} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50">
                            <input
                                type="checkbox"
                                checked={selectedIds.includes(item.id)}
                                onChange={() => onToggle(item.id)}
                                className="mt-0.5"
                            />
                            <span>
                                <span className="block text-sm text-slate-800">{item.name}</span>
                                {renderMeta?.(item) && <span className="block text-xs text-slate-500">{renderMeta(item)}</span>}
                            </span>
                        </label>
                    ))
                )}
            </div>
        </div>
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
    const [preview, setPreview] = useState<PreviewResponse | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const hasAudience =
        data.all_faculties ||
        data.all_departments ||
        data.all_staff ||
        data.faculty_ids.length > 0 ||
        data.department_ids.length > 0 ||
        data.staff_ids.length > 0;

    const selectedStaff = useMemo(
        () => staffOptions.filter((item) => data.staff_ids.includes(item.id)),
        [staffOptions, data.staff_ids],
    );

    useEffect(() => {
        let cancelled = false;

        const timer = window.setTimeout(async () => {
            if (!hasAudience) {
                setPreview(null);
                setPreviewError(null);
                return;
            }

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
                    setPreviewError(getApiErrorMessage(error, 'Unable to preview recipients.'));
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
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        const result = await apiJsonRequest<{ data: StaffOption[] }>(`${staffSearchRoute}?${params.toString()}`);
        setStaffOptions(result.data);
    };

    const searchFaculties = async (search: string) => {
        if (!facultySearchRoute) return;
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        const result = await apiJsonRequest<{ data: FacultyOption[] }>(`${facultySearchRoute}?${params.toString()}`);
        setFacultyOptions(result.data);
    };

    const searchDepartments = async (search: string) => {
        if (!departmentSearchRoute) return;
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        const result = await apiJsonRequest<{ data: DepartmentOption[] }>(`${departmentSearchRoute}?${params.toString()}`);
        setDepartmentOptions(result.data);
    };

    useEffect(() => {
        let cancelled = false;

        apiJsonRequest<{ data: StaffOption[] }>(staffSearchRoute)
            .then((result) => {
                if (!cancelled) {
                    setStaffOptions(result.data);
                }
            })
            .catch(() => undefined);

        return () => {
            cancelled = true;
        };
    }, [staffSearchRoute]);

    const submit = (asDraft: boolean) => {
        transform((current) => ({ ...current, save_as_draft: asDraft }));
        post(storeRoute);
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        setConfirmOpen(true);
    };

    const needsStrongConfirm = data.all_faculties || data.all_departments || data.all_staff || Boolean(preview?.large_audience);

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Subject</label>
                    <input
                        value={data.subject}
                        onChange={(event) => setData('subject', event.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        required
                    />
                    {errors.subject && <p className="mt-1 text-sm text-rose-600">{errors.subject}</p>}
                </div>

                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Message</label>
                    <textarea
                        value={data.body}
                        onChange={(event) => setData('body', event.target.value)}
                        rows={8}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        required
                    />
                    {errors.body && <p className="mt-1 text-sm text-rose-600">{errors.body}</p>}
                </div>

                <div className="space-y-3">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900">Recipients</h2>
                        <p className="text-xs text-slate-500">
                            {mode === 'admin'
                                ? 'Choose one or more faculties/directorates, departments, or staff members.'
                                : `Messages stay within ${capabilities.scope_label}.`}
                        </p>
                    </div>

                    {mode === 'admin' && (
                        <div className="grid gap-3 md:grid-cols-2">
                            {capabilities.can_send_all_faculties && (
                                <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={data.all_faculties}
                                        onChange={(event) => setData('all_faculties', event.target.checked)}
                                    />
                                    All Faculties/Directorates
                                </label>
                            )}
                            {capabilities.can_send_all_departments && (
                                <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={data.all_departments}
                                        onChange={(event) => setData('all_departments', event.target.checked)}
                                    />
                                    All Departments
                                </label>
                            )}
                            {capabilities.can_send_all_staff && (
                                <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={data.all_staff}
                                        onChange={(event) => setData('all_staff', event.target.checked)}
                                    />
                                    All Staff
                                </label>
                            )}
                        </div>
                    )}

                    {mode === 'leader' && capabilities.can_send_all_staff && (
                        <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                            <input type="checkbox" checked={data.all_staff} onChange={(event) => setData('all_staff', event.target.checked)} />
                            {capabilities.all_staff_label}
                        </label>
                    )}

                    {mode === 'admin' && capabilities.can_send_selected_faculties && !data.all_faculties && (
                        <SearchablePicker
                            label="Selected Faculties/Directorates"
                            placeholder="Search faculties..."
                            items={facultyOptions}
                            selectedIds={data.faculty_ids}
                            onToggle={(id) => setData('faculty_ids', toggleId(data.faculty_ids, id))}
                            onSearch={(value) => searchFaculties(value).catch(() => undefined)}
                        />
                    )}

                    {mode === 'admin' && capabilities.can_send_selected_departments && !data.all_departments && (
                        <SearchablePicker
                            label="Selected Departments"
                            placeholder="Search departments..."
                            items={departmentOptions}
                            selectedIds={data.department_ids}
                            onToggle={(id) => setData('department_ids', toggleId(data.department_ids, id))}
                            onSearch={(value) => searchDepartments(value).catch(() => undefined)}
                            renderMeta={(item) => item.faculty_name}
                        />
                    )}

                    {capabilities.can_send_selected_staff && !data.all_staff && (
                        <SearchablePicker
                            label="Selected Staff"
                            placeholder="Search staff by name or employee ID..."
                            items={staffOptions}
                            selectedIds={data.staff_ids}
                            onToggle={(id) => setData('staff_ids', toggleId(data.staff_ids, id))}
                            onSearch={(value) => searchStaff(value).catch(() => undefined)}
                            renderMeta={(item) => [item.employee_id, item.department, item.faculty].filter(Boolean).join(' · ')}
                        />
                    )}

                    {selectedStaff.length > 0 && (
                        <button type="button" className="text-xs font-medium text-slate-600 underline" onClick={() => setData('staff_ids', [])}>
                            Clear selected staff
                        </button>
                    )}
                    {errors.recipients && <p className="text-sm text-rose-600">{errors.recipients}</p>}
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Recipient preview</p>
                    {!hasAudience && <p className="mt-1 text-sm text-slate-500">Select a recipient group to see who will receive this message.</p>}
                    {previewError && <p className="mt-1 text-sm text-rose-600">{previewError}</p>}
                    {preview && (
                        <div className="mt-2 space-y-1 text-sm text-slate-600">
                            <p>
                                <span className="font-medium text-slate-900">{preview.count}</span> eligible staff will receive this message.
                            </p>
                            {preview.groups.length > 0 && <p>Audience: {preview.groups.join(' · ')}</p>}
                            {preview.warning && <p className="font-medium text-amber-700">{preview.warning}</p>}
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                    <Link href={cancelHref} className="rounded-lg border px-4 py-2 text-sm">
                        Cancel
                    </Link>
                    {capabilities.can_manage_drafts && (
                        <Button
                            type="button"
                            variant="outline"
                            disabled={processing}
                            onClick={() => submit(true)}
                        >
                            Save draft
                        </Button>
                    )}
                    <Button type="submit" disabled={processing || !capabilities.can_send}>
                        {processing ? 'Sending...' : 'Send message'}
                    </Button>
                </div>
            </form>

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Send this message?</DialogTitle>
                        <DialogDescription>
                            {needsStrongConfirm
                                ? 'This will notify a large or institution-wide audience. Confirm the recipient list before sending.'
                                : 'Confirm the subject and recipient list before sending.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 text-sm text-slate-600">
                        <p>
                            <span className="font-medium text-slate-900">Subject:</span> {data.subject || '—'}
                        </p>
                        <p>
                            <span className="font-medium text-slate-900">Recipients:</span> {preview?.count ?? 0} staff
                        </p>
                        {preview?.groups?.length ? <p>{preview.groups.join(' · ')}</p> : null}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
                            Cancel
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
