import React, { useState, useEffect } from 'react';
import { Head, useForm } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { AlertCircle } from 'lucide-react';
import TextField from '@mui/material/TextField';
import { Textarea } from '@headlessui/react';
import Button from '@mui/material/Button';
import ComboBox from '@/components/combobox';

interface FormData {
  name: string;
  faculty: number | null;
}

interface FormErrors {
  [key: string]: string;
}

interface FacultyOption {
  label: string;
  value: number;
}

interface Department {
  id: number;
  name: string;
  faculty_id: number;
}

interface EditDepartmentPageProps {
  department: Department;
  facultyOptions: FacultyOption[];
}

const EditDepartmentPage = ({ facultyOptions, department }: EditDepartmentPageProps ) => {
  const initialFormState: FormData = {
    name: department.name,
    faculty: department.faculty_id,
  };

  const [formData, setFormData] = useState<FormData>(initialFormState);
  const {data, setData, put, errors, processing} = useForm(formData);

  // Find the initial faculty option based on department.faculty_id
  const initialFacultyOption = facultyOptions.find(option => option.value === department.faculty_id) || null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    put(route('admin.school-management.departments.update', department.id));
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
              {/* Department Name */}
              <div>
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

              {/* Faculty Selection */}
              <div>
                <ComboBox
                  options={facultyOptions}
                  label="Select Faculty"
                  externalValue={handleValueChange}
                  defaultValue={initialFacultyOption}
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
                  type="submit"
                  color="primary"
                  variant="contained"
                  disabled={processing}
                  className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white py-4 px-16"
                >
                  {processing ? 'Updating...' : 'Update Department'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default EditDepartmentPage;