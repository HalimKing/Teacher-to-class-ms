import React, { useEffect, useState } from 'react';
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
  department: null | number;
  faculty: number;
  name: string;

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
interface DepartmentOption {
  label: string;
  value: string;
}
interface Program {
  id: number;
  name: string;
  department_id: number;
  faculty_id: number;
}

interface ProgramsIndexPageProps {
  facultyOptions: FacultyOption[];
  program: Program;
}

const titleData = [
  { label: 'Mr.', value: 'Mr.' },
  { label: 'Ms.', value: 'Ms.' },
  { label: 'Dr.', value: 'Dr.' },
  { label: 'Prof.', value: 'Prof.' },
];
const CreateTeacherPage = ({ program, facultyOptions }: ProgramsIndexPageProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const { departments, faculties } = usePage<PageProps>().props;
  const [departmentsOptions, setDepartments] = useState<{label: string; value: string}[]>([]);
  const [initialDepartment, setInitialDepartment] = useState<DepartmentOption | null>(null);

  const { data, setData, put, processing, errors, reset } = useForm<FormData>({
    department: program.department_id || null,
    name: program.name,
    faculty: program.faculty_id,

  });

  const initialFacultyOption = facultyOptions.find(option => option.value === program.faculty_id) || null;

  // Fetch departments when component mounts and when faculty changes
  useEffect(() => {
    if (initialFacultyOption) {
      fetchDepartments(initialFacultyOption.value);
    }
  }, []);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    put(route('admin.school-management.programs.update', program.id), {
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
  

    const handleValueChangeFaculty = (value: string | number | undefined) => {
        setData('faculty', value as number);
        fetchDepartments(value as number);
        setInitialDepartment(null);
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

      if (program.department_id && program.faculty_id === facultyId) {
        const currentDepartment = departmentOptions.find(
          (dept: DepartmentOption) => dept.value === program.department_id.toString()
        );
        if (currentDepartment) {
          setInitialDepartment(currentDepartment);
          setData('department', program.department_id);
        }
      }

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
      title: 'Programs',
      href: '/admin/school-management/programs',
    },
    {
      title: 'Edit Program',
      href: '/admin/school-management/programs',
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
               
                {/* Professional Information */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center">
                    <GraduationCap className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                    Professional Information
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <TextField
                        label="Program Name"
                        name="name"
                        value={data.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        fullWidth
                        required
                        error={!!errors.name}
                        helperText={errors.name}
                        placeholder="e.g., Bachelor of Science in Computer Science"
                        variant="outlined"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <ComboBox
                          options={facultyOptions}
                          label="Select Faculty"
                          externalValue={handleValueChangeFaculty}
                          defaultValue={initialFacultyOption}
                        />
                      </div>
                      <div>
                        <ComboBox
                          options={departmentsOptions}
                          label="Select Department"
                          externalValue={handleValueChange}
                          defaultValue={initialDepartment}
                          
                        />
                        {errors.department && (
                          <p className="mt-1 text-sm text-red-500">{errors.department}</p>
                        )}
                      </div>
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
                    className={`px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-medium rounded-xl transition-all duration-200 shadow-sm ${
                      processing ? 'opacity-75 cursor-not-allowed' : ''
                    }`}
                    disabled={processing}
                  >
                    {processing ? 'Updating...' : 'Update'}
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