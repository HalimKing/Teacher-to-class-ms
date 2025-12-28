import React, { useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { AlertCircle } from 'lucide-react';
import TextField from '@mui/material/TextField';
import { Textarea } from '@headlessui/react';
import Button from '@mui/material/Button';

interface FormData {
  name: string;
  description: string;

}

interface FormErrors {
  [key: string]: string;
}

const CreateFacultyPage = () => {
  const initialFormState: FormData = {
    name: '',
    description: '',
   
  };

  const [formData, setFormData] = useState<FormData>(initialFormState);
//   const [errors, setErrors] = useState<FormErrors>({});
  const {data, setData, post, errors, processing} = useForm(formData)
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Faculty name is required';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setData(prev => ({
      ...prev,
      [name]: value
    }));
    
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
        setIsSubmitting(true);
    
    post(route('admin.school-management.faculties.store'))
    


    
  };

  const breadcrumbs = [
    {
      title: 'Dashboard',
      href: '/admin/dashboard',
    },
    {
      title: 'Faculties',
      href: '/admin/school-management/faculties',
    },
    {
      title: 'Create Faculty',
      href: '/admin/school-management/faculty/create',
    }
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Create Faculty" />
      
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <h1 className="text-2xl font-bold text-slate-900">Create New Faculty</h1>
              <p className="mt-1 text-sm text-slate-500">Fill in the details to create a new faculty.</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Faculty Name */}
              <div>
                {/* <label className="block text-sm font-medium text-slate-700 mb-2">
                  Faculty Name <span className="text-red-500">*</span>
                </label> */}
                <TextField
                label="Faculty Name"
                    type="text"
                    name="name"
                    value={data.name}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2.5 border ${errors.name ? 'border-red-500' : 'border-slate-300'} rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
                />
                {/* <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2.5 border ${errors.name ? 'border-red-500' : 'border-slate-300'} rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
                /> */}
                {errors.name && (
                  <p className="mt-1 text-sm text-red-500 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                
                <textarea
                  name="description"
                  value={data.description}
                  onChange={handleInputChange}
                  rows={4}
                  className={`w-full px-4 py-2.5 border ${errors.description ? 'border-red-500' : 'border-slate-300'} rounded-xl focus:ring-2 focus:ring-cyan-600 focus:border-transparent outline-none`}
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-500 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.description}
                  </p>
                )}
              </div>

              
              

              <div className="flex justify-end space-x-4 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => setFormData(initialFormState)}
                  className="px-6 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50"
                >
                  Reset
                </button>
                <Button
                type='submit'
                color='primary'
                variant='contained'
                disabled={processing}
                className='bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white'
                // style={{ backgroundColor: 'blue' }}
                >{processing ? 'Creating...' : 'Create Faculty'}</Button>
                
                
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CreateFacultyPage;