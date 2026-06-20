import TeacherBulkActionsBar from '@/components/teachers/TeacherBulkActionsBar';
import TeacherDataTable from '@/components/teachers/TeacherDataTable';
import TeacherFiltersPanel from '@/components/teachers/TeacherFiltersPanel';
import TeacherImportExportPanel from '@/components/teachers/TeacherImportExportPanel';
import TeacherPageHeader from '@/components/teachers/TeacherPageHeader';
import TeacherQuickViewPanel from '@/components/teachers/TeacherQuickViewPanel';
import {
    type TeacherFilters,
    type TeacherListItem,
    type TeacherQuickViewData,
    type TeachersIndexPageProps,
} from '@/components/teachers/types';
import { KpiGrid } from '@/components/dashboard/kpi-card';
import AppLayout from '@/layouts/app-layout';
import { buildListQueryParams, listQueryParamsEqual } from '@/lib/list-filters';
import { type BreadcrumbItem, type PagePropsWithFlash } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ToastContainer, toast, Bounce } from 'react-toastify';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'Teacher Management', href: '/admin/teachers' },
];

export default function TeachersIndexPage({
    summaryCards,
    teachers,
    faculties,
    departments,
    filters: initialFilters,
}: TeachersIndexPageProps) {
    const { flash } = usePage().props as PagePropsWithFlash;
    const [filters, setFilters] = useState<TeacherFilters>(initialFilters);
    const [sortBy, setSortBy] = useState(initialFilters.sort_by ?? 'created_at');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialFilters.sort_dir === 'asc' ? 'asc' : 'desc');
    const [perPage, setPerPage] = useState(Number(initialFilters.per_page ?? teachers.per_page ?? 15));
    const [bulkMode, setBulkMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [previewRows, setPreviewRows] = useState<any[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [quickViewTeacher, setQuickViewTeacher] = useState<TeacherListItem | null>(null);
    const [quickViewData, setQuickViewData] = useState<TeacherQuickViewData | null>(null);
    const [quickViewLoading, setQuickViewLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, { theme: 'dark', transition: Bounce });
        }
        if (flash?.error) {
            toast.error(flash.error, { theme: 'dark', transition: Bounce });
        }
    }, [flash?.success, flash?.error]);

    useEffect(() => {
        const removeStartListener = router.on('start', () => setRefreshing(true));
        const removeFinishListener = router.on('finish', () => setRefreshing(false));

        return () => {
            removeStartListener();
            removeFinishListener();
        };
    }, []);

    const queryParams = useMemo(
        () =>
            buildListQueryParams(filters, {
                sortBy,
                sortDir,
                perPage,
            }),
        [filters, sortBy, sortDir, perPage],
    );

    const skipInitialFilterFetch = useRef(true);

    useEffect(() => {
        setSortBy(initialFilters.sort_by ?? 'created_at');
        setSortDir(initialFilters.sort_dir === 'asc' ? 'asc' : 'desc');
        setPerPage(Number(initialFilters.per_page ?? teachers.per_page ?? 15));
    }, [initialFilters.sort_by, initialFilters.sort_dir, initialFilters.per_page, teachers.per_page]);

    useEffect(() => {
        if (skipInitialFilterFetch.current) {
            skipInitialFilterFetch.current = false;
            return;
        }

        const nextParams = buildListQueryParams(filters, {
            sortBy,
            sortDir,
            perPage,
            page: 1,
        });

        const currentParams = buildListQueryParams(initialFilters, {
            sortBy: initialFilters.sort_by ?? 'created_at',
            sortDir: initialFilters.sort_dir === 'asc' ? 'asc' : 'desc',
            perPage: Number(initialFilters.per_page ?? teachers.per_page ?? 15),
            page: 1,
        });

        if (listQueryParamsEqual(nextParams, currentParams)) {
            return;
        }

        const timeoutId = setTimeout(() => {
            router.get(route('admin.teachers.index'), nextParams, {
                preserveState: true,
                replace: true,
                only: ['teachers', 'summaryCards', 'filters'],
            });
        }, 400);

        return () => clearTimeout(timeoutId);
    }, [filters]);

    const handleFilterChange = (key: keyof TeacherFilters, value: string) => {
        setFilters((current) => {
            const next = { ...current, [key]: value };
            if (key === 'faculty') {
                next.department = 'all';
            }

            return next;
        });
    };

    const handleClearFilters = () => {
        setFilters({});
        router.get(route('admin.teachers.index'));
    };

    const handleSort = (column: string) => {
        const nextDir = sortBy === column && sortDir === 'desc' ? 'asc' : 'desc';
        setSortBy(column);
        setSortDir(nextDir);
        router.get(route('admin.teachers.index'), { ...queryParams, sort_by: column, sort_dir: nextDir, page: 1 }, { preserveState: true, replace: true });
    };

    const handlePageChange = (page: number) => {
        router.get(route('admin.teachers.index'), { ...queryParams, page }, { preserveState: true });
    };

    const handlePerPageChange = (nextPerPage: number) => {
        setPerPage(nextPerPage);
        router.get(route('admin.teachers.index'), { ...queryParams, per_page: nextPerPage, page: 1 }, { preserveState: true, replace: true });
    };

    const buildExportUrl = (format: 'excel' | 'csv' | 'pdf' | 'print', ids?: number[]) => {
        const params = new URLSearchParams(queryParams as Record<string, string>);
        if (ids?.length) {
            params.set('ids', ids.join(','));
        }

        return `${route('admin.teachers.export', format)}?${params.toString()}`;
    };

    const handleExport = (format: 'excel' | 'csv' | 'pdf' | 'print') => {
        if (format === 'print') {
            window.open(buildExportUrl(format), '_blank');
            return;
        }

        window.location.href = buildExportUrl(format);
    };

    const handleQuickView = async (teacher: TeacherListItem) => {
        setQuickViewTeacher(teacher);
        setQuickViewData(null);
        setQuickViewLoading(true);

        try {
            const response = await fetch(route('admin.teachers.quick-view', teacher.id), {
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });
            const payload = await response.json();
            if (!response.ok || !payload.success) {
                throw new Error(payload.message || 'Unable to load teacher details.');
            }
            setQuickViewData(payload.data);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Unable to load teacher details.', { theme: 'dark' });
            setQuickViewTeacher(null);
        } finally {
            setQuickViewLoading(false);
        }
    };

    const handleDelete = (teacherId: number) => {
        if (confirm('Are you sure you want to delete this teacher?')) {
            router.delete(route('admin.teachers.destroy', teacherId), { preserveScroll: true });
        }
    };

    const handleFaceEnrollmentReminder = () => {
        toast.info(`Enrollment reminder queued for ${selectedIds.length} selected teacher(s).`, { theme: 'dark' });
    };

    const handlePreview = async (event: FormEvent) => {
        event.preventDefault();
        if (!importFile) {
            toast.error('Please select a file to preview.', { theme: 'dark' });
            return;
        }

        setPreviewLoading(true);
        const formData = new FormData();
        formData.append('file', importFile);
        const token = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

        try {
            const response = await fetch(route('admin.teachers.preview'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
                body: formData,
            });
            const json = await response.json();

            if (!response.ok) {
                throw new Error(json.error || json.message || 'Unable to preview file.');
            }

            setPreviewRows(json.rows || []);
            setShowPreview(true);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Unable to preview file.', { theme: 'dark' });
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleConfirmImport = async () => {
        if (!importFile) {
            return;
        }

        setConfirmLoading(true);
        const formData = new FormData();
        formData.append('file', importFile);
        const token = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

        try {
            const response = await fetch(route('admin.teachers.confirm-import'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
                body: formData,
            });
            const json = await response.json();

            if (!response.ok) {
                throw new Error(json.error || 'Import failed.');
            }

            toast.success(`Imported ${json.imported} rows, skipped ${json.skipped}.`, { theme: 'dark' });
            setShowPreview(false);
            router.reload();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Import failed.', { theme: 'dark' });
        } finally {
            setConfirmLoading(false);
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
    };

    const toggleSelectAll = (ids: number[]) => {
        setSelectedIds((current) => {
            const allSelected = ids.every((id) => current.includes(id));
            if (allSelected) {
                return current.filter((id) => !ids.includes(id));
            }

            return [...new Set([...current, ...ids])];
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Teacher Management" />

            <div className="space-y-6 p-4 sm:p-6 lg:p-8">
                <TeacherPageHeader
                    onRefresh={() => router.reload()}
                    onExport={handleExport}
                    onToggleBulk={() => setBulkMode((current) => !current)}
                    bulkMode={bulkMode}
                    refreshing={refreshing}
                />

                <KpiGrid cards={summaryCards} />

                <TeacherFiltersPanel
                    filters={filters}
                    faculties={faculties}
                    departments={departments}
                    onChange={handleFilterChange}
                    onClear={handleClearFilters}
                />

                {bulkMode && (
                    <TeacherBulkActionsBar
                        selectedCount={selectedIds.length}
                        onExportSelected={(format) => {
                            window.location.href = buildExportUrl(format, selectedIds);
                        }}
                        onFaceEnrollmentReminder={handleFaceEnrollmentReminder}
                        onClearSelection={() => setSelectedIds([])}
                    />
                )}

                <TeacherDataTable
                    teachers={teachers}
                    selectedIds={selectedIds}
                    bulkMode={bulkMode}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    perPage={perPage}
                    loading={refreshing}
                    onSort={handleSort}
                    onPageChange={handlePageChange}
                    onPerPageChange={handlePerPageChange}
                    onToggleSelect={toggleSelect}
                    onToggleSelectAll={toggleSelectAll}
                    onQuickView={handleQuickView}
                    onDelete={handleDelete}
                />

                <TeacherImportExportPanel
                    fileName={importFile?.name ?? null}
                    previewLoading={previewLoading}
                    onFileChange={setImportFile}
                    onPreview={handlePreview}
                    onExport={handleExport}
                />
            </div>

            <TeacherQuickViewPanel
                open={Boolean(quickViewTeacher)}
                loading={quickViewLoading}
                teacher={quickViewTeacher}
                data={quickViewData}
                onClose={() => {
                    setQuickViewTeacher(null);
                    setQuickViewData(null);
                }}
            />

            {showPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPreview(false)} aria-label="Close import preview" />
                    <div className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl border border-sidebar-border/70 bg-white shadow-2xl dark:bg-sidebar-accent">
                        <div className="flex items-center justify-between border-b border-sidebar-border/60 px-6 py-4">
                            <div>
                                <h3 className="text-xl font-semibold text-sidebar-foreground">Import Preview</h3>
                                <p className="text-sm text-sidebar-foreground/60">Review {previewRows.length} row(s) before importing.</p>
                            </div>
                            <button type="button" onClick={() => setShowPreview(false)} className="rounded-lg p-2 hover:bg-muted/40">
                                <X className="size-5" />
                            </button>
                        </div>
                        <div className="max-h-[calc(90vh-180px)] overflow-auto p-6">
                            <table className="min-w-full divide-y divide-sidebar-border/60">
                                <thead className="bg-muted/40">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Line</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Name</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Employee ID</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Faculty / Dept</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Errors</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sidebar-border/50">
                                    {previewRows.map((row: any, index: number) => (
                                        <tr key={index}>
                                            <td className="px-4 py-3 text-sm">{row.line}</td>
                                            <td className="px-4 py-3 text-sm">{[row.data.first_name, row.data.last_name].filter(Boolean).join(' ') || '—'}</td>
                                            <td className="px-4 py-3 text-sm">{row.data.employee_id ?? '—'}</td>
                                            <td className="px-4 py-3 text-sm">{[row.data.faculty, row.data.department].filter(Boolean).join(' / ') || '—'}</td>
                                            <td className="px-4 py-3 text-sm">
                                                {row.errors.length > 0 ? 'Error' : row.exists ? 'Exists' : 'New'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-destructive">{row.errors.length > 0 ? row.errors.join(', ') : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-end gap-3 border-t border-sidebar-border/60 px-6 py-4">
                            <button type="button" onClick={() => setShowPreview(false)} className="rounded-lg border px-4 py-2 text-sm">
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmImport}
                                disabled={confirmLoading || previewRows.filter((row: any) => row.errors.length === 0).length === 0}
                                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                            >
                                {confirmLoading ? 'Importing...' : 'Confirm Import'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ToastContainer />
        </AppLayout>
    );
}
