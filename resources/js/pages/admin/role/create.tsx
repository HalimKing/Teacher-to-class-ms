import React, { useState } from 'react';
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

interface Permissions {
  id: number;
  name: string;
}

const CreateClassRoomPage = ({ permissions }: { permissions: Permissions[] }) => {
  const initialFormState: FormData = {
    name: '',
    permissions: [],
  };

  const { data, setData, post, errors, processing } = useForm<FormData>(initialFormState);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'number') {
      setData(name as keyof FormData, value === '' ? null : Number(value));
    } else {
      setData(name as keyof FormData, value);
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    const intValue = value as string
    let updatedPermissions = [...data.permissions];

    if (checked) {
      updatedPermissions.push(intValue);
    } else {
      updatedPermissions = updatedPermissions.filter(permission => permission !== intValue);
    }

    setData('permissions', updatedPermissions);
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
    }
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Create Role" />
      
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <h1 className="text-2xl font-bold text-slate-900">Create New Role</h1>
              <p className="mt-1 text-sm text-slate-500">Fill in the details to create a new role.</p>
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
                      />
                    </div>

                    <div>
                        {/* list permissions */}
                        <h3 className="text-md font-medium text-slate-700 mb-2">Assign Permissions</h3>
                        <div className="max-h-60 overflow-y-auto border border-slate-300 rounded-md p-4 bg-slate-50">
                          {permissions.map((permission) => (
                            <div key={permission.id} className="flex items-center mb-2">
                                <label htmlFor={`permission-${permission.id}`} className='flex justify-items-center gap-2'>
                                  <Input
                                    type="checkbox"
                                    name="permissions"
                                    className="form-checkbox h-5 w-5 text-indigo-600 border-slate-300 rounded"
                                    id={`permission-${permission.id}`}
                                    value={permission.name}
                                    // checked={data.permissions.includes(permission.id)}
                                    onChange={handleCheckboxChange}
                                  />
                                <span>{permission.name}</span>
                                </label>
                              
                            </div>
                          ))}
                        </div>
                        {errors.permissions && (
                            <p className="mt-2 text-sm text-red-600 flex items-center">
                                <AlertCircle className="mr-2" />
                                {errors.permissions}
                            </p>
                        )}
                    </div>
                    
                  </div>
                </div>

              

              </div>

              <div className="flex justify-end space-x-4 pt-6 border-t">
                <Button
                  type="submit"
                  color="primary"
                  variant="contained"
                  disabled={processing}
                  className="bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white md:h-12"
                >
                  {processing ? 'Creating...' : 'Create Class Room'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CreateClassRoomPage;