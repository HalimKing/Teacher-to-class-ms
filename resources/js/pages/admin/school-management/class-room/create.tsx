import React, { useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { AlertCircle } from 'lucide-react';
import TextField from '@mui/material/TextField';
import { Switch, FormControlLabel } from '@mui/material';
import Button from '@mui/material/Button';

interface FormData {
  name: string;
  capacity: number;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number | null;
  is_active: boolean;
}

const CreateClassRoomPage = () => {
  const initialFormState: FormData = {
    name: '',
    capacity: 0,
    latitude: null,
    longitude: null,
    radius_meters: null,
    is_active: true,
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

  const handleSwitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData('is_active', e.target.checked);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    post(route('admin.school-management.class-rooms.store'));
  };

  const breadcrumbs = [
    {
      title: 'Dashboard',
      href: '/admin/dashboard',
    },
    {
      title: 'Class Rooms',
      href: '/admin/school-management/class-rooms',
    },
    {
      title: 'Create Class Room',
      href: '/admin/school-management/class-rooms/create',
    }
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Create Class Room" />
      
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <h1 className="text-2xl font-bold text-slate-900">Create New Class Room</h1>
              <p className="mt-1 text-sm text-slate-500">Fill in the details to create a new class room.</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-6">
                {/* Basic Information Section */}
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 mb-4">Basic Information</h2>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <TextField
                        fullWidth
                        label="Class Room Name"
                        type="text"
                        name="name"
                        value={data.name}
                        onChange={handleInputChange}
                        error={!!errors.name}
                        helperText={errors.name}
                      />
                    </div>
                    <div>
                      <TextField
                        fullWidth
                        label="Capacity"
                        type="number"
                        name="capacity"
                        value={data.capacity}
                        onChange={handleInputChange}
                        error={!!errors.capacity}
                        helperText={errors.capacity}
                        InputProps={{ inputProps: { min: 0 } }}
                      />
                    </div>
                  </div>
                </div>

                {/* Location Information Section */}
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 mb-4">Location Information</h2>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div>
                      <TextField
                        fullWidth
                        label="Latitude"
                        type="number"
                        name="latitude"
                        value={data.latitude || ''}
                        onChange={handleInputChange}
                        error={!!errors.latitude}
                        helperText={errors.latitude}
                        placeholder="e.g., 40.7128"
                        InputProps={{
                          inputProps: { 
                            step: "0.000001",
                          }
                        }}
                      />
                    </div>
                    <div>
                      <TextField
                        fullWidth
                        label="Longitude"
                        type="number"
                        name="longitude"
                        value={data.longitude || ''}
                        onChange={handleInputChange}
                        error={!!errors.longitude}
                        helperText={errors.longitude}
                        placeholder="e.g., -74.0060"
                        InputProps={{
                          inputProps: { 
                            step: "0.000001",
                            max: 180
                          }
                        }}
                      />
                    </div>
                    <div>
                      <TextField
                        fullWidth
                        label="Radius (meters)"
                        type="number"
                        name="radius_meters"
                        value={data.radius_meters || ''}
                        onChange={handleInputChange}
                        error={!!errors.radius_meters}
                        helperText={errors.radius_meters}
                        InputProps={{ inputProps: { min: 0 } }}
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    Optional: Set geographical boundaries for attendance tracking
                  </p>
                </div>

                {/* Status Section */}
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 mb-4">Status</h2>
                  <div className="flex items-center">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={data.is_active}
                          onChange={handleSwitchChange}
                          name="is_active"
                          color="primary"
                        />
                      }
                      label={data.is_active ? "Active" : "Inactive"}
                    />
                    <span className="ml-4 text-sm text-slate-500">
                      {data.is_active 
                        ? "This class room is active and available for use."
                        : "This class room is inactive and won't be available for scheduling."
                      }
                    </span>
                  </div>
                  {errors.is_active && (
                    <p className="mt-1 text-sm text-red-500 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {errors.is_active}
                    </p>
                  )}
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