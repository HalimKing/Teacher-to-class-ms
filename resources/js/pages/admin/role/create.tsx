import AppLayout from '@/layouts/app-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { AlertCircle, ArrowLeft, Search, Shield } from 'lucide-react';
import React, { useMemo, useState } from 'react';

interface FormData {
    name: string;
    permissions: string[];
}

interface Permission {
    id: number;
    name: string;
}

type GroupedPermissions = Record<string, Permission[]>;

interface CreateRolePageProps {
    permissions: GroupedPermissions;
}

const formatGroupName = (groupName: string) => {
    const labels: Record<string, string> = {
        'admin.system-logs': 'System Logs',
        'admin.settings': 'Settings',
        'admin.dashboard': 'Dashboard',
        'admin.attendance': 'Teacher Attendance',
        'admin.staff-attendance': 'Staff Attendance',
        'admin.teachers': 'Teachers',
        'admin.user-management': 'User Management',
        'admin.academics': 'Academics',
        'admin.school-management': 'School Management',
        'admin.schedules': 'Schedules',
    };

    return labels[groupName] ?? groupName.replace(/^admin\./, '').replace(/-/g, ' ').replace(/\./g, ' › ');
};

const formatPermissionLabel = (permissionName: string) => {
    return (
        permissionName
            .split('.')
            .slice(1)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ') || 'View'
    );
};

const CreateRolePage = ({ permissions }: CreateRolePageProps) => {
    const [permissionSearch, setPermissionSearch] = useState('');

    const initialFormState: FormData = {
        name: '',
        permissions: [],
    };

    const { data, setData, post, errors, processing } = useForm<FormData>(initialFormState);

    const totalPermissions = useMemo(
        () => Object.values(permissions).reduce((count, group) => count + group.length, 0),
        [permissions],
    );

    const filteredPermissions = useMemo(() => {
        const query = permissionSearch.trim().toLowerCase();
        if (!query) {
            return permissions;
        }

        return Object.fromEntries(
            Object.entries(permissions)
                .map(([groupName, groupPermissions]) => [
                    groupName,
                    groupPermissions.filter(
                        (permission) =>
                            permission.name.toLowerCase().includes(query) ||
                            formatGroupName(groupName).toLowerCase().includes(query) ||
                            formatPermissionLabel(permission.name).toLowerCase().includes(query),
                    ),
                ])
                .filter(([, groupPermissions]) => groupPermissions.length > 0),
        );
    }, [permissionSearch, permissions]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setData('name', e.target.value);
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        const updatedPermissions = checked
            ? [...data.permissions, value]
            : data.permissions.filter((permission) => permission !== value);

        setData('permissions', updatedPermissions);
    };

    const handleSelectAll = (groupName: string) => {
        const groupPermissions = permissions[groupName] || [];
        const permissionNames = groupPermissions.map((permission) => permission.name);
        const allSelected = permissionNames.every((permission) => data.permissions.includes(permission));

        if (allSelected) {
            setData(
                'permissions',
                data.permissions.filter((permission) => !permissionNames.includes(permission)),
            );
            return;
        }

        setData('permissions', Array.from(new Set([...data.permissions, ...permissionNames])));
    };

    const handleSelectAllVisible = () => {
        const visiblePermissionNames = Object.values(filteredPermissions).flatMap((group) =>
            group.map((permission) => permission.name),
        );
        const allSelected = visiblePermissionNames.every((permission) => data.permissions.includes(permission));

        if (allSelected) {
            setData(
                'permissions',
                data.permissions.filter((permission) => !visiblePermissionNames.includes(permission)),
            );
            return;
        }

        setData('permissions', Array.from(new Set([...data.permissions, ...visiblePermissionNames])));
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        post(route('admin.user-management.roles.store'));
    };

    const breadcrumbs = [
        {
            title: 'Dashboard',
            href: '/admin/dashboard',
        },
        {
            title: 'Roles',
            href: '/admin/user-management/roles',
        },
        {
            title: 'Create Role',
            href: '/admin/user-management/roles/create',
        },
    ];

    const visiblePermissionCount = Object.values(filteredPermissions).reduce(
        (count, group) => count + group.length,
        0,
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Role" />

            <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-5xl">
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                        <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-purple-50 p-6">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
                                        <Shield className="size-6" />
                                    </div>
                                    <div>
                                        <h1 className="text-2xl font-bold text-slate-900">Create New Role</h1>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Define a role name and assign the permissions this role should have.
                                        </p>
                                    </div>
                                </div>

                                <Link
                                    href={route('admin.user-management.roles.index')}
                                    className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                    <ArrowLeft className="size-4" />
                                    Back to Roles
                                </Link>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6 p-6">
                            <div className="space-y-6">
                                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
                                    <h2 className="mb-4 text-lg font-semibold text-slate-800">Role Details</h2>
                                    <div className="max-w-xl">
                                        <TextField
                                            fullWidth
                                            label="Role Name"
                                            type="text"
                                            name="name"
                                            value={data.name}
                                            onChange={handleInputChange}
                                            error={!!errors.name}
                                            helperText={errors.name || 'Use a clear name such as Registrar or Finance Officer.'}
                                            placeholder="e.g. Academic Coordinator"
                                            variant="outlined"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <h2 className="text-lg font-semibold text-slate-800">Permissions</h2>
                                            <p className="mt-1 text-sm text-slate-500">
                                                {data.permissions.length} of {totalPermissions} permission(s) selected
                                            </p>
                                        </div>

                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                            <div className="relative w-full sm:w-72">
                                                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={permissionSearch}
                                                    onChange={(e) => setPermissionSearch(e.target.value)}
                                                    placeholder="Search permissions..."
                                                    className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                                />
                                            </div>

                                            <button
                                                type="button"
                                                onClick={handleSelectAllVisible}
                                                className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-300"
                                            >
                                                {Object.values(filteredPermissions)
                                                    .flatMap((group) => group.map((permission) => permission.name))
                                                    .every((permission) => data.permissions.includes(permission))
                                                    ? 'Deselect Visible'
                                                    : 'Select Visible'}
                                            </button>
                                        </div>
                                    </div>

                                    {visiblePermissionCount === 0 ? (
                                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                                            <p className="text-sm font-medium text-slate-700">No permissions match your search.</p>
                                            <p className="mt-1 text-sm text-slate-500">Try a different keyword or clear the search field.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-5">
                                            {Object.entries(filteredPermissions).map(([groupName, groupPermissions]) => {
                                                const permissionNames = groupPermissions.map((permission) => permission.name);
                                                const selectedCount = permissionNames.filter((permission) =>
                                                    data.permissions.includes(permission),
                                                ).length;
                                                const allSelected = selectedCount === permissionNames.length;

                                                return (
                                                    <div
                                                        key={groupName}
                                                        className="overflow-hidden rounded-xl border border-slate-200"
                                                    >
                                                        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className="font-semibold text-slate-800">
                                                                        {formatGroupName(groupName)}
                                                                    </span>
                                                                    <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-600">
                                                                        {selectedCount}/{groupPermissions.length} selected
                                                                    </span>
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSelectAll(groupName)}
                                                                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                                                                        allSelected
                                                                            ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                                                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                                                    }`}
                                                                >
                                                                    {allSelected ? 'Deselect All' : 'Select All'}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 gap-3 bg-white p-4 md:grid-cols-2 xl:grid-cols-3">
                                                            {groupPermissions.map((permission) => {
                                                                const isChecked = data.permissions.includes(permission.name);

                                                                return (
                                                                    <div
                                                                        key={permission.id}
                                                                        className={`rounded-lg border p-3 transition-all ${
                                                                            isChecked
                                                                                ? 'border-indigo-300 bg-indigo-50'
                                                                                : 'border-slate-200 hover:border-slate-300'
                                                                        }`}
                                                                    >
                                                                        <label className="flex cursor-pointer items-start gap-3">
                                                                            <div className="relative mt-0.5">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    name="permissions"
                                                                                    className="peer sr-only"
                                                                                    value={permission.name}
                                                                                    checked={isChecked}
                                                                                    onChange={handleCheckboxChange}
                                                                                />
                                                                                <div
                                                                                    className={`flex size-5 items-center justify-center rounded border transition-colors ${
                                                                                        isChecked
                                                                                            ? 'border-indigo-600 bg-indigo-600'
                                                                                            : 'border-slate-300 bg-white'
                                                                                    }`}
                                                                                >
                                                                                    {isChecked && (
                                                                                        <svg
                                                                                            className="size-3 text-white"
                                                                                            fill="none"
                                                                                            viewBox="0 0 24 24"
                                                                                            stroke="currentColor"
                                                                                        >
                                                                                            <path
                                                                                                strokeLinecap="round"
                                                                                                strokeLinejoin="round"
                                                                                                strokeWidth="3"
                                                                                                d="M5 13l4 4L19 7"
                                                                                            />
                                                                                        </svg>
                                                                                    )}
                                                                                </div>
                                                                            </div>

                                                                            <div className="min-w-0 flex-1">
                                                                                <div className="font-medium text-slate-800">
                                                                                    {formatPermissionLabel(permission.name)}
                                                                                </div>
                                                                                <div className="truncate font-mono text-xs text-slate-500">
                                                                                    {permission.name}
                                                                                </div>
                                                                            </div>
                                                                        </label>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {errors.permissions && (
                                        <div className="mt-4">
                                            <p className="flex items-center text-sm text-red-600">
                                                <AlertCircle className="mr-2 size-4" />
                                                {errors.permissions}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
                                <Button
                                    type="button"
                                    variant="outlined"
                                    onClick={() => window.history.back()}
                                    className="border-slate-300 text-slate-700 hover:border-slate-400"
                                    disabled={processing}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    color="primary"
                                    variant="contained"
                                    disabled={processing}
                                    className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-md transition-shadow hover:from-indigo-700 hover:to-purple-800 hover:shadow-lg md:h-12"
                                >
                                    {processing ? 'Creating...' : 'Create Role'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};

export default CreateRolePage;
