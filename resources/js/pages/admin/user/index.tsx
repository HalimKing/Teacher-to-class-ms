import ResetPasswordModal from '@/components/users/ResetPasswordModal';
import UserBulkActionsBar from '@/components/users/UserBulkActionsBar';
import UserDataTable from '@/components/users/UserDataTable';
import UserFiltersPanel from '@/components/users/UserFiltersPanel';
import UserPageHeader from '@/components/users/UserPageHeader';
import UserQuickViewPanel from '@/components/users/UserQuickViewPanel';
import {
    type UserFilters,
    type UserListItem,
    type UserQuickViewData,
    type UsersIndexPageProps,
} from '@/components/users/types';
import { KpiGrid } from '@/components/dashboard/kpi-card';
import AppLayout from '@/layouts/app-layout';
import { buildListQueryParams, listQueryParamsEqual } from '@/lib/list-filters';
import { type BreadcrumbItem, type PagePropsWithFlash } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ToastContainer, toast, Bounce } from 'react-toastify';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'User Management', href: '/admin/user-management/users' },
];

export default function UsersIndexPage({
    summaryCards,
    users,
    roles,
    filters: initialFilters,
    statusOptions,
}: UsersIndexPageProps) {
    const { flash } = usePage().props as PagePropsWithFlash & { generatedPassword?: string };
    const [filters, setFilters] = useState<UserFilters>(initialFilters);
    const [sortBy, setSortBy] = useState(initialFilters.sort_by ?? 'created_at');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialFilters.sort_dir === 'asc' ? 'asc' : 'desc');
    const [perPage, setPerPage] = useState(Number(initialFilters.per_page ?? users.per_page ?? 15));
    const [quickViewUser, setQuickViewUser] = useState<UserListItem | null>(null);
    const [quickViewData, setQuickViewData] = useState<UserQuickViewData | null>(null);
    const [quickViewLoading, setQuickViewLoading] = useState(false);
    const [resetUser, setResetUser] = useState<UserListItem | null>(null);
    const [resetLoading, setResetLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [bulkMode, setBulkMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, { theme: 'dark', transition: Bounce });
        }
        if (flash?.error) {
            toast.error(flash.error, { theme: 'dark', transition: Bounce });
        }
        if (flash?.generatedPassword) {
            toast.info(`Temporary password: ${flash.generatedPassword}`, { theme: 'dark', autoClose: false });
        }
    }, [flash?.success, flash?.error, flash?.generatedPassword]);

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
        setPerPage(Number(initialFilters.per_page ?? users.per_page ?? 15));
    }, [initialFilters.sort_by, initialFilters.sort_dir, initialFilters.per_page, users.per_page]);

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
            perPage: Number(initialFilters.per_page ?? users.per_page ?? 15),
            page: 1,
        });

        if (listQueryParamsEqual(nextParams, currentParams)) {
            return;
        }

        const timeoutId = setTimeout(() => {
            router.get(route('admin.user-management.users.index'), nextParams, {
                preserveState: true,
                replace: true,
                only: ['users', 'summaryCards', 'filters'],
            });
        }, 400);

        return () => clearTimeout(timeoutId);
    }, [filters]);

    const handleFilterChange = (key: keyof UserFilters, value: string) => {
        setFilters((current) => ({ ...current, [key]: value }));
    };

    const handleClearFilters = () => {
        setFilters({});
        router.get(route('admin.user-management.users.index'));
    };

    const handleSort = (column: string) => {
        const nextDir = sortBy === column && sortDir === 'desc' ? 'asc' : 'desc';
        setSortBy(column);
        setSortDir(nextDir);
        router.get(route('admin.user-management.users.index'), { ...queryParams, sort_by: column, sort_dir: nextDir, page: 1 }, { preserveState: true, replace: true });
    };

    const handlePageChange = (page: number) => {
        router.get(route('admin.user-management.users.index'), { ...queryParams, page }, { preserveState: true });
    };

    const handlePerPageChange = (nextPerPage: number) => {
        setPerPage(nextPerPage);
        router.get(route('admin.user-management.users.index'), { ...queryParams, per_page: nextPerPage, page: 1 }, { preserveState: true, replace: true });
    };

    const handleRefresh = () => {
        router.get(route('admin.user-management.users.index'), queryParams, {
            preserveState: true,
            replace: true,
            only: ['users', 'summaryCards', 'filters'],
        });
    };

    const buildExportUrl = (format: 'excel' | 'csv' | 'pdf' | 'print', ids?: number[]) => {
        const params = new URLSearchParams(queryParams as Record<string, string>);
        if (ids?.length) {
            params.set('ids', ids.join(','));
        }

        return `${route('admin.user-management.users.export', format)}?${params.toString()}`;
    };

    const handleExport = (format: 'excel' | 'csv' | 'pdf' | 'print') => {
        if (format === 'print') {
            window.open(buildExportUrl(format), '_blank');
            return;
        }

        window.location.href = buildExportUrl(format);
    };

    const postBulkAction = async (url: string, payload: Record<string, unknown>) => {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
        const response = await fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Bulk action failed.');
        }

        return result;
    };

    const handleToggleSelect = (id: number) => {
        setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
    };

    const handleToggleSelectAll = (ids: number[]) => {
        setSelectedIds(ids);
    };

    const handleBulkExport = (format: 'excel' | 'csv' | 'pdf') => {
        window.location.href = buildExportUrl(format, selectedIds);
    };

    const handleBulkSetStatus = async (status: 'active' | 'inactive' | 'suspended') => {
        try {
            const result = await postBulkAction(route('admin.user-management.users.bulk.status'), {
                ids: selectedIds,
                status,
            });
            toast.success(result.message, { theme: 'dark' });
            setSelectedIds([]);
            router.reload({ only: ['users', 'summaryCards'] });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Bulk update failed.', { theme: 'dark' });
        }
    };

    const handleBulkRequirePasswordChange = async () => {
        try {
            const result = await postBulkAction(route('admin.user-management.users.bulk.require-password-change'), {
                ids: selectedIds,
            });
            toast.success(result.message, { theme: 'dark' });
            setSelectedIds([]);
            router.reload({ only: ['users', 'summaryCards'] });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Bulk action failed.', { theme: 'dark' });
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Delete ${selectedIds.length} selected user(s)?`)) {
            return;
        }

        try {
            const result = await postBulkAction(route('admin.user-management.users.bulk.delete'), {
                ids: selectedIds,
            });
            toast.success(result.message, { theme: 'dark' });
            setSelectedIds([]);
            router.reload({ only: ['users', 'summaryCards'] });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Bulk delete failed.', { theme: 'dark' });
        }
    };

    const handleQuickView = async (user: UserListItem) => {
        setQuickViewUser(user);
        setQuickViewData(null);
        setQuickViewLoading(true);

        try {
            const response = await fetch(route('admin.user-management.users.quick-view', user.id), {
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });
            const payload = await response.json();
            if (!response.ok || !payload.success) {
                throw new Error(payload.message || 'Unable to load user details.');
            }
            setQuickViewData(payload.data);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Unable to load user details.', { theme: 'dark' });
            setQuickViewUser(null);
        } finally {
            setQuickViewLoading(false);
        }
    };

    const handleDelete = (userId: number) => {
        if (confirm('Are you sure you want to delete this user?')) {
            router.delete(route('admin.user-management.users.destroy', userId), { preserveScroll: true });
        }
    };

    const handleResetPassword = async (payload: {
        mode: 'generate' | 'manual';
        password?: string;
        password_confirmation?: string;
        force_change_on_login: boolean;
        send_reset_link: boolean;
    }) => {
        if (!resetUser) {
            return;
        }

        setResetLoading(true);

        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
            const response = await fetch(route('admin.user-management.users.reset-password', resetUser.id), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Password reset failed.');
            }

            toast.success(result.message || 'Password reset successfully.', { theme: 'dark' });
            router.reload({ only: ['users', 'summaryCards'] });

            return { temporary_password: result.data?.temporary_password ?? null };
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Password reset failed.', { theme: 'dark' });
        } finally {
            setResetLoading(false);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="User Management" />
            <div className="space-y-6 p-4 sm:p-6 lg:p-8">
                <UserPageHeader
                    onRefresh={handleRefresh}
                    onExport={handleExport}
                    onToggleBulk={() => {
                        setBulkMode((current) => !current);
                        setSelectedIds([]);
                    }}
                    bulkMode={bulkMode}
                    refreshing={refreshing}
                />

                <KpiGrid cards={summaryCards} />

                <UserBulkActionsBar
                    selectedCount={selectedIds.length}
                    onExportSelected={handleBulkExport}
                    onClearSelection={() => setSelectedIds([])}
                    onSetStatus={handleBulkSetStatus}
                    onRequirePasswordChange={handleBulkRequirePasswordChange}
                    onDeleteSelected={handleBulkDelete}
                />

                <UserFiltersPanel
                    filters={filters}
                    roles={roles}
                    statusOptions={statusOptions}
                    onChange={handleFilterChange}
                    onClear={handleClearFilters}
                />

                <UserDataTable
                    users={users}
                    selectedIds={selectedIds}
                    bulkMode={bulkMode}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    perPage={perPage}
                    onSort={handleSort}
                    onPageChange={handlePageChange}
                    onPerPageChange={handlePerPageChange}
                    onToggleSelect={handleToggleSelect}
                    onToggleSelectAll={handleToggleSelectAll}
                    onQuickView={handleQuickView}
                    onResetPassword={setResetUser}
                    onDelete={handleDelete}
                    loading={refreshing}
                />
            </div>

            <UserQuickViewPanel
                open={Boolean(quickViewUser)}
                loading={quickViewLoading}
                user={quickViewUser}
                data={quickViewData}
                onClose={() => setQuickViewUser(null)}
                onResetPassword={(user) => {
                    setQuickViewUser(null);
                    setResetUser(user);
                }}
            />

            <ResetPasswordModal
                open={Boolean(resetUser)}
                user={resetUser}
                loading={resetLoading}
                onClose={() => setResetUser(null)}
                onSubmit={handleResetPassword}
            />

            <ToastContainer />
        </AppLayout>
    );
}
