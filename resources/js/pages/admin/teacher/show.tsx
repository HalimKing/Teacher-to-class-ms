import React, { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { 
  GraduationCap,
  ChevronDown,
  User,
  Mail,
  Phone,
  IdCard,
  Building,
  BookOpen,
  Award
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';

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

interface Teacher {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  employee_id: string | number;
  faculty_id: number;
  department_id: number;
  title: string;
}

interface ShowTeacherPageProps {
  teacher: Teacher;
  facultyOptions: FacultyOption[];
}

const ShowTeacherPage = ({ facultyOptions, teacher }: ShowTeacherPageProps) => {
  const { departments, faculties } = usePage<PageProps>().props;
  const [departmentName, setDepartmentName] = useState<string>('');
  const [facultyName, setFacultyName] = useState<string>('');

  // Fetch department and faculty names
  useEffect(() => {
    if (teacher.faculty_id) {
      const faculty = facultyOptions.find(option => option.value === teacher.faculty_id);
      if (faculty) {
        setFacultyName(faculty.label);
      }
    }

    // Fetch department name
    const fetchDepartmentName = async () => {
      if (teacher.faculty_id && teacher.department_id) {
        try {
          const response = await fetch(`/api/faculties/${teacher.faculty_id}/departments`);
          const departmentsData = await response.json();
          const department = departmentsData.find((dept: any) => dept.id === teacher.department_id);
          if (department) {
            setDepartmentName(department.name);
          }
        } catch (error) {
          console.error('Error fetching department:', error);
        }
      }
    };

    fetchDepartmentName();
  }, [teacher, facultyOptions]);

  const breadcrumbs = [
    {
      title: 'Admin',
      href: '/admin/dashboard',
    },
    {
      title: 'Teachers',
      href: '/admin/teachers',
    },
    {
      title: 'Teacher Details',
      href: `/admin/teachers/${teacher.id}`,
    }
  ];

  // Helper function to render info field
  const renderInfoField = (icon: React.ReactNode, label: string, value: string) => (
    <div className="flex items-start space-x-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
      <div className="flex-shrink-0 w-5 h-5 text-slate-400 dark:text-slate-500 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
          {label}
        </p>
        <p className="text-base text-slate-900 dark:text-white font-medium">
          {value || 'Not specified'}
        </p>
      </div>
    </div>
  );

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
            <div className="max-w-4xl mx-auto">
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
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                      {teacher.title} {teacher.first_name} {teacher.last_name}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400">
                      Teacher Profile Details
                    </p>
                  </div>
                  <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-3 py-1 rounded-full text-sm font-medium">
                    Active
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Personal Information */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center">
                    <User className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInfoField(
                      <User className="w-5 h-5" />,
                      'First Name',
                      teacher.first_name
                    )}
                    {renderInfoField(
                      <User className="w-5 h-5" />,
                      'Last Name',
                      teacher.last_name
                    )}
                    {renderInfoField(
                      <Mail className="w-5 h-5" />,
                      'Email Address',
                      teacher.email
                    )}
                    {renderInfoField(
                      <Phone className="w-5 h-5" />,
                      'Phone Number',
                      teacher.phone
                    )}
                  </div>
                </div>

                {/* Professional Information */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center">
                    <GraduationCap className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                    Professional Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInfoField(
                      <IdCard className="w-5 h-5" />,
                      'Employee ID',
                      teacher.employee_id?.toString() || 'Not assigned'
                    )}
                    {renderInfoField(
                      <Award className="w-5 h-5" />,
                      'Title',
                      teacher.title
                    )}
                    {renderInfoField(
                      <Building className="w-5 h-5" />,
                      'Faculty',
                      facultyName
                    )}
                    {renderInfoField(
                      <BookOpen className="w-5 h-5" />,
                      'Department',
                      departmentName
                    )}
                  </div>
                </div>

                {/* Additional Information */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
                    Additional Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInfoField(
                      <IdCard className="w-5 h-5" />,
                      'Teacher ID',
                      `#${teacher.id}`
                    )}
                    {renderInfoField(
                      <User className="w-5 h-5" />,
                      'Full Name',
                      `${teacher.title} ${teacher.first_name} ${teacher.last_name}`
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end space-x-4 pt-6">
                  <button
                    type="button"
                    onClick={() => window.history.back()}
                    className="px-6 py-3 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors font-medium"
                  >
                    Back to List
                  </button>
                  <button
                    type="button"
                    onClick={() => window.location.href = `/admin/teachers/${teacher.id}/edit`}
                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-lg transition-colors font-medium"
                  >
                    Edit Teacher Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ShowTeacherPage;