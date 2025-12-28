import React, { useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { AlertCircle } from 'lucide-react';
import TextField from '@mui/material/TextField';
import { Textarea } from '@headlessui/react';
import Button from '@mui/material/Button';

interface FormData {
  name: string;
  capacity: number;
}

interface ClassRoom {
  id: number;
  name: string;
  capacity: number;
}

interface FormErrors {
  [key: string]: string;
}

const EditClassRoomPage = ({ classRoom }: { classRoom: ClassRoom }) => {
  const initialFormState: FormData = {
    name: classRoom.name,
   capacity: classRoom.capacity,
  };

  const [formData, setFormData] = useState<FormData>(initialFormState);
//   const [errors, setErrors] = useState<FormErrors>({});
  const {data, setData, put, errors, processing} = useForm(formData)


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setData((prev: FormData) => ({
      ...prev,
      [name]: value
    }));
    
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    put(route('admin.school-management.class-rooms.update', classRoom.id))

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
      <Head title="Edit Class Room" />
      
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <h1 className="text-2xl font-bold text-slate-900">Create New Class Room</h1>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
                <div>
            
                  <TextField
                  label="Class Room Name"
                      type="text"
                      name="name"
                      value={data.name}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2.5 border ${errors.name ? 'border-red-500' : 'border-slate-300'} rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
                  />
                
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-500 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {errors.name}
                    </p>
                  )}
                </div>
                <div>
                  <TextField
                  label="Capacity"
                      type="number"
                      name="capacity"
                      value={data.capacity}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2.5 border ${errors.capacity ? 'border-red-500' : 'border-slate-300'} rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
                  />
                  
                  {errors.capacity && (
                    <p className="mt-1 text-sm text-red-500 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {errors.capacity}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end space-x-4 pt-6 border-t">
                
                <Button
                type='submit'
                color='primary'
                variant='contained'
                disabled={processing}
                className='bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white py-4 px-16 md:h-12'
                // style={{ backgroundColor: 'blue' }}
                >{processing ? 'Updating...' : 'Update Class Room'}</Button>
                
                
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default EditClassRoomPage;