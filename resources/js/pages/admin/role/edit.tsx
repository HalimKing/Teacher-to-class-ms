import React, { useState, useEffect } from 'react';
import { Head, useForm } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { AlertCircle } from 'lucide-react';
import TextField from '@mui/material/TextField';
import { Switch, FormControlLabel, Input } from '@mui/material';
import Button from '@mui/material/Button';

interface FormData {
  name: string;
  permissions: string[];
}

interface Permission {
  id: number;
  name: string;
}

interface GroupedPermissions {
  [key: string]: Permission[];
}

interface Role {
  id: number;
  name: string;
  permissions: string[]; // Array of permission IDs from the role
}

interface EditRolePageProps {
  role: Role;
  permissions: GroupedPermissions;
}

const EditRolePage = ({ role, permissions }: EditRolePageProps) => {
  const initialFormState: FormData = {
    name: role.name,
    permissions: role.permissions || [],
  };

  const { data, setData, put, errors, processing } = useForm<FormData>(initialFormState);

  // Update form data when role prop changes
  useEffect(() => {
    setData({
      name: role.name,
      permissions: role.permissions || [],
    });
  }, [role]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setData(name as keyof FormData, value);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    let updatedPermissions = [...data.permissions];

    if (checked) {
      updatedPermissions.push(value);
    } else {
      updatedPermissions = updatedPermissions.filter(permission => permission !== value);
    }

    setData('permissions', updatedPermissions);
  };

  const handleSelectAll = (groupName: string) => {
    const groupPermissions = permissions[groupName] || [];
    const permissionNames = groupPermissions.map(p => p.name);
    const currentPermissions = new Set(data.permissions);
    
    // If all are selected, deselect all
    const allSelected = permissionNames.every(p => currentPermissions.has(p));
    
    if (allSelected) {
      // Remove all permissions from this group
      const newPermissions = data.permissions.filter(p => !permissionNames.includes(p));
      setData('permissions', newPermissions);
    } else {
      // Add all permissions from this group
      const newPermissions = Array.from(new Set([...data.permissions, ...permissionNames]));
      setData('permissions', newPermissions);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    put(route('admin.user-management.roles.update', role.id));
  };

  const breadcrumbs = [
    {
      title: 'Dashboard',
      href: '/admin/dashboard',
    },
    {
      title: 'Roles',
      href: '/admin/roles',
    },
    {
      title: `Edit ${role.name}`,
      href: `/admin/roles/${role.id}/edit`,
    }
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`Edit Role: ${role.name}`} />
      
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Edit Role</h1>
                  <p className="mt-1 text-sm text-slate-500">Update role details and permissions.</p>
                </div>
                <div className="text-sm text-slate-500">
                  Role ID: <span className="font-mono bg-slate-100 px-2 py-1 rounded">{role.id}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-6">
                {/* Basic Information Section */}
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 mb-4">Basic Information</h2>
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <TextField
                        fullWidth
                        label="Role Name"
                        type="text"
                        name="name"
                        value={data.name}
                        onChange={handleInputChange}
                        error={!!errors.name}
                        helperText={errors.name}
                        variant="outlined"
                        size="medium"
                      />
                    </div>

                    {/* Permissions Section */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-800">Permissions</h3>
                        <div className="text-sm text-slate-500">
                          {data.permissions.length} permission(s) selected
                        </div>
                      </div>
                      
                      <div className="space-y-6">
                        {Object.entries(permissions).map(([groupName, groupPermissions]) => {
                          const permissionNames = groupPermissions.map(p => p.name);
                          const selectedCount = permissionNames.filter(p => 
                            data.permissions.includes(p)
                          ).length;
                          const allSelected = selectedCount === permissionNames.length;
                          
                          return (
                            <div key={groupName} className="border border-slate-200 rounded-xl overflow-hidden">
                              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-semibold text-slate-800 capitalize">
                                      {groupName.replace('-', ' ')}
                                    </span>
                                    <span className="text-sm text-slate-500 bg-slate-200 px-2 py-1 rounded-full">
                                      {groupPermissions.length} permissions
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleSelectAll(groupName)}
                                    className={`text-sm font-medium px-3 py-1 rounded-lg transition-colors ${
                                      allSelected 
                                        ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                    }`}
                                  >
                                    {allSelected ? 'Deselect All' : 'Select All'}
                                  </button>
                                </div>
                              </div>
                              
                              <div className="p-4 bg-white">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {groupPermissions.map((permission) => {
                                    const isChecked = data.permissions.includes(permission.name);
                                    const formattedName = permission.name
                                      .split('.')
                                      .slice(1)
                                      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                      .join(' ');
                                    
                                    return (
                                      <div 
                                        key={permission.id} 
                                        className={`border rounded-lg p-3 transition-all ${
                                          isChecked 
                                            ? 'border-indigo-300 bg-indigo-50' 
                                            : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                      >
                                        <label className="flex items-center space-x-3 cursor-pointer">
                                          <div className="relative">
                                            <input
                                              type="checkbox"
                                              name="permissions"
                                              className="sr-only peer"
                                              value={permission.name}
                                              checked={isChecked}
                                              onChange={handleCheckboxChange}
                                            />
                                            <div className={`w-5 h-5 border rounded flex items-center justify-center transition-colors ${
                                              isChecked 
                                                ? 'bg-indigo-600 border-indigo-600' 
                                                : 'border-slate-300 bg-white'
                                            }`}>
                                              {isChecked && (
                                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                </svg>
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex-1">
                                            <div className="font-medium text-slate-800">
                                              {formattedName || 'View'}
                                            </div>
                                            <div className="text-xs text-slate-500 font-mono truncate">
                                              {permission.name}
                                            </div>
                                          </div>
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {errors.permissions && (
                        <div className="mt-4">
                          <p className="text-sm text-red-600 flex items-center">
                            <AlertCircle className="mr-2 h-4 w-4" />
                            {errors.permissions}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-6 border-t border-slate-200">
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
                  className="bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white shadow-md hover:shadow-lg transition-shadow"
                >
                  {processing ? 'Updating...' : 'Update Role'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default EditRolePage;