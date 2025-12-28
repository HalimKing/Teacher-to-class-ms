import React, { useState } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import { 
  GraduationCap,
  ChevronDown,
  User,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import TextField from '@mui/material/TextField';
import ComboBox from '@/components/combobox';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import { theme } from '@/components/theme/mui-theme';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: null | number;
  title: string;
  faculty: number;
  employeeId: string;

}

interface PageProps {
  departments: string[];
  faculties: string[];
  [key: string]: any;
}
interface FacultyOption {
  label: string;
  value: number;
}

const titleData = [
  { label: 'Mr.', value: 'Mr.' },
  { label: 'Ms.', value: 'Ms.' },
  { label: 'Dr.', value: 'Dr.' },
  { label: 'Prof.', value: 'Prof.' },
];
const CreateTeacherPage = ({facultyOptions}: {facultyOptions: FacultyOption[]}) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const { departments, faculties } = usePage<PageProps>().props;
  const [departmentsOptions, setDepartments] = useState<{label: string; value: string}[]>([]);

  const { data, setData, post, processing, errors, reset } = useForm<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    department: null,
    title: '',
    employeeId: '',
   
    faculty: 0,
  
  });



  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    post(route('admin.teachers.store'), {
      onSuccess: () => {
        reset();
        // Inertia will handle the redirect or success message
      },
      onError: (errors) => {
        console.error('Form submission errors:', errors);
      }
    });
  };

     const handleValueChange = (value: string | number | undefined) => {
        setData('department', value as number);
    };
     const handleTitleChange = (value: string | number | undefined) => {
        setData('title', value as string);
    };

    const handleValueChangeFaculty = (value: string | number | undefined) => {
        setData('faculty', value as number);
        fetchDepartments(value as number);
    }


    const fetchDepartments = async (facultyId: number) => {
    try {
      const response = await fetch(`/api/faculties/${facultyId}/departments`);
      const departmentsData = await response.json();
      
      
      
      const departmentOptions = departmentsData.map((dept: any) => ({
        label: dept.name,
        value: dept.id.toString()
      }));
      
      setDepartments(departmentOptions);
    } catch (error) {
      console.error('Error fetching departments:', error);
      setDepartments([]);
    } 
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setData(field, value);
  };

  // Helper function to render form input with error
  const renderInput = (name: keyof FormData, label: string, type = 'text', required = true) => (
    <div>
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
        className="mb-4 dark:text-white"
      />
    </div>
  );

  const breadcrumbs = [
    {
      title: 'Admin',
      href: '/admin/dashboard',
    },
    {
      title: 'Teachers',
      href: '/admin/teachers',
    }
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <ThemeProvider theme={theme}>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
              <div className="max-w-5xl mx-auto">
              {/* Back Button */}
              <div className="mb-8">
                <button 
                  type="button"
                  onClick={() => window.history.back()}
                  className="flex items-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 mb-4 transition-colors"
                >
                  <ChevronDown className="w-5 h-5 mr-1 rotate-90" />
                  Back to Teachers
                </button>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Add New Teacher</h2>
                <p className="text-slate-600 dark:text-slate-400">Fill in the information below to create a new teacher profile</p>
              </div>

              <form onSubmit={handleSubmit}>
                {/* Personal Information */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center">
                    <User className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {renderInput('firstName', 'First Name')}
                    {renderInput('lastName', 'Last Name')}
                    <div>
                      <TextField
                        type="email"
                        label="Email Address"
                        name="email"
                        value={data.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        fullWidth
                        required
                        error={!!errors.email}
                        helperText={errors.email}
                        placeholder="teacher@school.com"
                        variant="outlined"
                      />
                    </div>
                    <div>
                      <TextField
                        type="tel"
                        label="Phone Number"
                        name="phone"
                        value={data.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        fullWidth
                        required
                        error={!!errors.phone}
                        helperText={errors.phone}
                        placeholder="+1 234 567 8900"
                        variant="outlined"
                      />
                    </div>
                  </div>
                </div>

                {/* Professional Information */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center">
                    <GraduationCap className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                    Professional Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <TextField
                        label="Employee ID"
                        name="employeeId"
                        value={data.employeeId}
                        onChange={(e) => handleInputChange('employeeId', e.target.value)}
                        fullWidth
                        required
                        error={!!errors.employeeId}
                        helperText={errors.employeeId}
                        placeholder="EMP001"
                        variant="outlined"
                      />
                    </div>
                    <div>
                       <ComboBox
                        options={facultyOptions}
                        label="Select Faculty"
                        externalValue={handleValueChangeFaculty}
                        defaultValue={null}
                      />
                      
                    </div>
                    <div>
                      <ComboBox
                        options={departmentsOptions}
                        label="Select Department"
                        externalValue={handleValueChange}
                        defaultValue={null}
                      />
                      {errors.department && (
                        <p className="mt-1 text-sm text-red-500">{errors.department}</p>
                      )}
                     
                     
                     
                    </div>
                    <div>
                      <ComboBox
                        options={titleData}
                        label="Select Title"
                        externalValue={handleTitleChange}
                        defaultValue={null}
                      />
                      
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => window.history.back()}
                    className="px-6 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    disabled={processing}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium rounded-xl transition-all duration-200 shadow-sm ${
                      processing ? 'opacity-75 cursor-not-allowed' : ''
                    }`}
                    disabled={processing}
                  >
                    {processing ? 'Creating...' : 'Create Teacher Profile'}
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

export default CreateTeacherPage;