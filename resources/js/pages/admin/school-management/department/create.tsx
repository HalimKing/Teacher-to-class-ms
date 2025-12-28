import React, { useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { AlertCircle } from 'lucide-react';
import TextField from '@mui/material/TextField';
import { Textarea } from '@headlessui/react';
import Button from '@mui/material/Button';
import ComboBox from '@/components/combobox';

interface FormData {
  name: string;
  faculty: number;

}

interface FormErrors {
  [key: string]: string;
}

interface FacultyOption {
  label: string;
  value: number;
}

const CreateFacultyPage = ({ facultyOptions }: { facultyOptions: FacultyOption[] }) => {
  const initialFormState: FormData = {
    name: '',
    faculty: 0,
  };

  const [formData, setFormData] = useState<FormData>(initialFormState);
//   const [errors, setErrors] = useState<FormErrors>({});
  const {data, setData, post, errors, processing} = useForm(formData)
  const [isSubmitting, setIsSubmitting] = useState(false);



  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setData(prev => ({
      ...prev,
      [name]: value
    }));
    
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    post(route('admin.school-management.departments.store'))
    

  };

  const breadcrumbs = [
    {
      title: 'Dashboard',
      href: '/admin/dashboard',
    },
    {
      title: 'Departments',
      href: '/admin/school-management/departments',
    },
    {
      title: 'Create Department',
      href: '/admin/school-management/department/create',
    }
  ];

    const handleValueChange = (value: string | number | undefined) => {
        setData('faculty', value as number);
    };


  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Create Faculty" />
      
      <div className="min-h-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <h1 className="text-2xl font-bold text-slate-900">Create New Department</h1>
              <p className="mt-1 text-sm text-slate-500">Fill in the details to create a new faculty.</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Faculty Name */}
              <div>
                {/* <label className="block text-sm font-medium text-slate-700 mb-2">
                  Faculty Name <span className="text-red-500">*</span>
                </label> */}
                <TextField
                label="Department Name"
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

              {/* Description */}
              <div>
                
                <ComboBox
                    options={facultyOptions}
                    label="Select Faculty"
                    externalValue={handleValueChange}
                />
                
                {errors.faculty && (
                  <p className="mt-1 text-sm text-red-500 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.faculty}
                  </p>
                )}
              </div>


              <div className="flex justify-end space-x-4 pt-6 border-t">
               
                <Button
                type='submit'
                color='primary'
                variant='contained'
                disabled={processing}
                className='bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white'
                // style={{ backgroundColor: 'blue' }}
                >{processing ? 'Creating...' : 'Create Department'}</Button>
                
                
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CreateFacultyPage;