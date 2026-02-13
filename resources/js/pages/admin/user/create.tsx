import { theme } from '@/components/theme/mui-theme';
import AppLayout from '@/layouts/app-layout';
import { Head, useForm, usePage } from '@inertiajs/react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Select from '@mui/material/Select';
import { ThemeProvider, useTheme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import { ChevronDown, Hash, Mail, Shield, User, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface Role {
    id: number;
    name: string;
}

interface FormData {
    name: string;
    email: string;
    staff_id: string;
    roles: string[]; // Changed to array of role names
}

interface PageProps {
    flash?: {
        success?: string;
        error?: string;
    };
    roles: Role[];
    [key: string]: any;
}

// Function to get chip styles based on role name
const getRoleChipStyles = (roleName: string) => {
    const baseStyles = {
        fontWeight: 500,
        fontSize: '0.75rem',
    };

    const lowerRoleName = roleName.toLowerCase();

    switch (lowerRoleName) {
        case 'admin':
            return {
                ...baseStyles,
                backgroundColor: 'rgb(239, 68, 68, 0.1)',
                color: '#ef4444',
                borderColor: 'rgb(239, 68, 68, 0.3)',
            };
        case 'editor':
            return {
                ...baseStyles,
                backgroundColor: 'rgb(59, 130, 246, 0.1)',
                color: '#3b82f6',
                borderColor: 'rgb(59, 130, 246, 0.3)',
            };
        case 'user':
            return {
                ...baseStyles,
                backgroundColor: 'rgb(34, 197, 94, 0.1)',
                color: '#22c55e',
                borderColor: 'rgb(34, 197, 94, 0.3)',
            };
        default:
            return {
                ...baseStyles,
                backgroundColor: 'rgb(168, 85, 247, 0.1)',
                color: '#a855f7',
                borderColor: 'rgb(168, 85, 247, 0.3)',
            };
    }
};

const CreateUserPage = ({ roles }: { roles: Role[] }) => {
    const { flash } = usePage<PageProps>().props;
    const muiTheme = useTheme();

    const { data, setData, post, processing, errors, reset } = useForm<FormData>({
        name: '',
        email: '',
        staff_id: '',
        roles: [], // Default empty array
    });

    const [defaultUserRoleName, setDefaultUserRoleName] = useState<string | null>(null);

    // Find and set default "user" role on component mount
    useEffect(() => {
        const userRole = roles.find((role) => role.name.toLowerCase() === 'user');
        if (userRole && data.roles.length === 0) {
            setData('roles', [userRole.name]);
            setDefaultUserRoleName(userRole.name);
        }
    }, [roles]);

    useEffect(() => {
        if (flash?.error) {
            console.error('Form error:', flash.error);
        }
    }, [flash]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Prepare the data to send
        const formData = {
            ...data,
            roles: data.roles, // Already contains role names
        };

        post(route('admin.user-management.users.store'));
    };

    const handleInputChange = (field: keyof Omit<FormData, 'roles'>, value: string) => {
        setData(field, value);
    };

    const handleRoleChange = (event: any) => {
        const {
            target: { value },
        } = event;
        console.log('Selected roles:', value);

        // On autofill we get a stringified value, so we need to handle that
        const selectedRoleNames = typeof value === 'string' ? value.split(',') : value;
        setData('roles', selectedRoleNames);
    };

    const handleRemoveRole = (roleNameToRemove: string) => {
        // Prevent removing the last role if it's the default user role
        if (roleNameToRemove === defaultUserRoleName && data.roles.length === 1) {
            return; // Don't allow removing the last/default role
        }

        const updatedRoles = data.roles.filter((roleName) => roleName !== roleNameToRemove);
        setData('roles', updatedRoles);
    };

    const renderInput = (name: keyof Omit<FormData, 'roles'>, label: string, type = 'text', required = true, icon?: React.ReactNode) => (
        <div className="relative">
            {icon && <div className="absolute top-1/2 left-3 -translate-y-1/2 transform text-slate-400 dark:text-slate-500">{icon}</div>}
            <TextField
                type={type}
                label={label}
                name={name}
                value={data[name]}
                onChange={(e) => handleInputChange(name, e.target.value)}
                fullWidth
                required={required}
                error={!!errors[name]}
                helperText={errors[name]}
                variant="outlined"
                className={`mb-4 ${icon ? 'pl-10' : ''}`}
                InputProps={{
                    sx: {
                        '& .MuiOutlinedInput-root': {
                            backgroundColor: 'transparent',
                        },
                        '& input': {
                            paddingLeft: icon ? '2.5rem' : '1rem',
                        },
                    },
                }}
            />
        </div>
    );

    const breadcrumbs = [
        {
            title: 'Admin',
            href: '/admin/dashboard',
        },
        {
            title: 'Users',
            href: '/admin/user-management/users',
        },
        {
            title: 'Create User',
            href: '#',
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create New User" />
            <ThemeProvider theme={theme}>
                <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
                    <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                            <div className="mx-auto max-w-2xl">
                                <div className="mb-8">
                                    <button
                                        type="button"
                                        onClick={() => window.history.back()}
                                        className="mb-4 flex items-center text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                                    >
                                        <ChevronDown className="mr-1 h-5 w-5 rotate-90" />
                                        Back to Users
                                    </button>
                                    <h2 className="mb-2 text-3xl font-bold text-slate-900 dark:text-white">Create New User</h2>
                                    <p className="text-slate-600 dark:text-slate-400">Add a new user account with appropriate permissions</p>
                                </div>

                                <form onSubmit={handleSubmit}>
                                    {/* Basic Information */}
                                    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                                        <h3 className="mb-6 flex items-center text-lg font-semibold text-slate-900 dark:text-white">
                                            <User className="mr-2 h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                            Basic Information
                                        </h3>
                                        <div className="space-y-4">
                                            {renderInput('name', 'Full Name', 'text', true, <User className="h-4 w-4" />)}
                                            {renderInput('email', 'Email Address', 'email', true, <Mail className="h-4 w-4" />)}
                                            {renderInput('staff_id', 'Staff ID', 'text', true, <Hash className="h-4 w-4" />)}

                                            {/* Multiple Role Select Field */}
                                            <div className="relative">
                                                <div className="absolute top-8 left-3 z-10 -translate-y-1/2 transform text-slate-400 dark:text-slate-500">
                                                    <Shield className="h-4 w-4" />
                                                </div>
                                                <FormControl fullWidth error={!!errors.roles}>
                                                    <InputLabel className="ml-10">Roles</InputLabel>
                                                    <Select
                                                        multiple
                                                        value={data.roles}
                                                        onChange={handleRoleChange}
                                                        input={<OutlinedInput label="Roles" />}
                                                        renderValue={(selected) => (
                                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, ml: 1 }}>
                                                                {selected.map((roleName) => (
                                                                    <Chip
                                                                        key={roleName}
                                                                        label={roleName}
                                                                        size="small"
                                                                        onDelete={
                                                                            defaultUserRoleName === roleName && data.roles.length === 1
                                                                                ? undefined
                                                                                : () => handleRemoveRole(roleName)
                                                                        }
                                                                        deleteIcon={
                                                                            defaultUserRoleName === roleName &&
                                                                            data.roles.length === 1 ? undefined : (
                                                                                <X className="h-3 w-3" />
                                                                            )
                                                                        }
                                                                        sx={getRoleChipStyles(roleName)}
                                                                        className="dark:border"
                                                                    />
                                                                ))}
                                                            </Box>
                                                        )}
                                                        className="mb-4"
                                                        MenuProps={{
                                                            PaperProps: {
                                                                className: 'dark:bg-slate-800 dark:text-white',
                                                                sx: {
                                                                    maxHeight: 200,
                                                                },
                                                            },
                                                        }}
                                                    >
                                                        {roles.map((role) => (
                                                            <MenuItem key={role.id} value={role.name} className="dark:hover:bg-slate-700">
                                                                <div className="flex w-full items-center justify-between">
                                                                    <span>{role.name}</span>
                                                                    {data.roles.includes(role.name) && (
                                                                        <div className="h-2 w-2 rounded-full bg-indigo-500" />
                                                                    )}
                                                                </div>
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                    {errors.roles && <FormHelperText>{errors.roles}</FormHelperText>}
                                                    <p className="mt-1 ml-1 text-sm text-slate-500 dark:text-slate-400">
                                                        Select one or more roles for the user
                                                        {defaultUserRoleName && (
                                                            <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                                                                Default role (User) cannot be removed
                                                            </span>
                                                        )}
                                                    </p>
                                                </FormControl>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Form Actions */}
                                    <div className="flex items-center justify-end space-x-4">
                                        <button
                                            type="button"
                                            onClick={() => window.history.back()}
                                            className="rounded-xl border border-slate-300 px-6 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                                            disabled={processing}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className={`rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-3 font-medium text-white shadow-sm transition-all duration-200 hover:from-indigo-600 hover:to-purple-700 ${
                                                processing ? 'cursor-not-allowed opacity-75' : ''
                                            }`}
                                            disabled={processing}
                                        >
                                            {processing ? 'Creating...' : 'Create User Account'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </ThemeProvider>
        </AppLayout>
    );
};

export default CreateUserPage;
