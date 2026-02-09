import React, { useState, useEffect } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import { 
  User,
  Mail,
  Hash,
  Lock,
  ChevronDown,
  Shield,
  Key,
  X,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import TextField from '@mui/material/TextField';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@/components/theme/mui-theme';
import { Head } from '@inertiajs/react';
import { Box, Chip, FormControl, FormHelperText, InputLabel, MenuItem, OutlinedInput, Select } from '@mui/material';

interface user {
  id: number;
  name: string;
  email: string;
  staff_id: string;
  created_at: string;
}

interface FormData {
  name: string;
  email: string;
  staff_id: string;
  roles: string[];
}

interface PageProps {
  flash?: {
    success?: string;
    error?: string;
  };
  user: user;
  roles: { id: number; name: string }[];
  userRoles: string[];
  [key: string]: any;
}

const roleOptions = [
  { label: 'User', value: 'user' },
  { label: 'Editor', value: 'editor' },
  { label: 'Admin', value: 'admin' },
];

const EditUserPage = ({user, roles, userRoles}: PageProps) => {
    
  const { flash } = usePage<PageProps>().props;
  // const [user, setUser] = useState<user>(user);
  
    const [defaultUserRoleName, setDefaultUserRoleName] = useState<string | null>(null);
  

  const { data, setData, put, processing, errors, reset } = useForm<FormData>({
    name: user.name || '',
    email: user.email || '',
    staff_id: user.staff_id || '',
    roles: userRoles || [],
  });


  useEffect(() => {
    if (flash?.error) {
      console.error('Form error:', flash.error);
    }
  }, [flash]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    

    put(route('admin.user-management.users.update', user.id), {
      onSuccess: () => {
        reset();
      },
      onError: (errors) => {
        console.error('Form submission errors:', errors);
      }
    });
  };


  
// Function to get chip styles based on role name
const getRoleChipStyles = (roleName: string) => {
  const baseStyles = {
    fontWeight: 500,
    fontSize: '0.75rem',
  };

  const lowerRoleName = roleName.toLowerCase();
  
  switch(lowerRoleName) {
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


const handleRemoveRole = (roleNameToRemove: string) => {
    // Prevent removing the last role if it's the default user role
    if (roleNameToRemove === defaultUserRoleName && data.roles.length === 1) {
      return; // Don't allow removing the last/default role
    }
    
    const updatedRoles = data.roles.filter(roleName => roleName !== roleNameToRemove);
    setData('roles', updatedRoles);
  };


  const handleInputChange = (field: keyof FormData, value: string) => {
    setData(field, value);
  };

    const handleRoleChange = (event: any) => {
    const { target: { value } } = event;
    
    // On autofill we get a stringified value, so we need to handle that
    const selectedRoleNames = typeof value === 'string' ? value.split(',') : value;
    setData('roles', selectedRoleNames);
  };


  // Helper function to render form input with error
  const renderInput = (name: keyof FormData, label: string, type = 'text', required = true, icon?: React.ReactNode) => (
    <div className="relative">
      {icon && (
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500">
          {icon}
        </div>
      )}
      <TextField
        type={type}
        label={label}
        name={name}
        value={data[name] || ''}
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
      title: `Edit ${user.name}`,
      href: '#',
    }
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`Edit ${user.name}`} />
      <ThemeProvider theme={theme}>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
              <div className="max-w-2xl mx-auto">
                {/* Back Button */}
                <div className="mb-8">
                  <button 
                    type="button"
                    onClick={() => window.history.back()}
                    className="flex items-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 mb-4 transition-colors"
                  >
                    <ChevronDown className="w-5 h-5 mr-1 rotate-90" />
                    Back to Users
                  </button>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Edit User</h2>
                  <p className="text-slate-600 dark:text-slate-400">Update user information and permissions</p>
                </div>

                {/* User Info Summary */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 mb-6 text-white">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                      <span className="text-xl font-bold">
                        {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{user.name}</h3>
                      <p className="text-indigo-100">{user.email}</p>
                      <div className="flex items-center space-x-4 mt-2 text-sm">
                        <span className="bg-white/20 px-3 py-1 rounded-full">
                          Staff ID: {user.staff_id}
                        </span>
                        
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-indigo-100">
                    Account created: {formatDate(user.created_at)}
                  </div>
                </div>

                <form onSubmit={handleSubmit}>
                  {/* Basic Information */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center">
                      <User className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                      Basic Information
                    </h3>
                    <div className="space-y-4">
                      {renderInput('name', 'Full Name', 'text', true, <User className="w-4 h-4" />)}
                      {renderInput('email', 'Email Address', 'email', true, <Mail className="w-4 h-4" />)}
                      {renderInput('staff_id', 'Staff ID', 'text', true, <Hash className="w-4 h-4" />)}
                    </div>
                  </div>

              
                  {/* Password Update (Optional) */}
                  
                  {/* Multiple Role Select Field */}
                      <div className="relative">
                        <div className="absolute left-3 top-8 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 z-10">
                          <Shield className="w-4 h-4" />
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
                                {selected.map((roleName) => {
                                  const canDelete = !(defaultUserRoleName === roleName && data.roles.length === 1);
                                  return (
                                    <Chip
                                      key={roleName}
                                      label={roleName}
                                      size="small"
                                      {...(canDelete && {
                                        onDelete: () => handleRemoveRole(roleName),
                                        deleteIcon: <X className="w-3 h-3" />
                                      })}
                                      sx={getRoleChipStyles(roleName)}
                                      className="dark:border"
                                    />
                                  );
                                })}
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
                              <MenuItem 
                                key={role.id} 
                                value={role.name}
                                className="dark:hover:bg-slate-700"
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span>{role.name}</span>
                                  {data.roles.includes(role.name) && (
                                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                  )}
                                </div>
                              </MenuItem>
                            ))}
                          </Select>
                          {errors.roles && <FormHelperText>{errors.roles}</FormHelperText>}
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 ml-1">
                            Select one or more roles for the user
                            {defaultUserRoleName && (
                              <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
                                Default role (User) cannot be removed
                              </span>
                            )}
                          </p>
                        </FormControl>
                      </div>

                  {/* Form Actions */}
                  <div className="flex items-center justify-between space-x-4">
                    <button
                      type="button"
                      onClick={() => window.history.back()}
                      className="px-6 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      disabled={processing}
                    >
                      Cancel
                    </button>
                    <div className="flex items-center space-x-4">
                      <button
                        type="submit"
                        className={`px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium rounded-xl transition-all duration-200 shadow-sm ${
                          processing ? 'opacity-75 cursor-not-allowed' : ''
                        }`}
                        disabled={processing}
                      >
                        {processing ? 'Updating...' : 'Update User'}
                      </button>
                    </div>
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

export default EditUserPage;