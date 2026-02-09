import React, { useState, useEffect } from 'react';
import { 
  Search,
  RefreshCw,
  Lock,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  Check
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Head, router, usePage } from '@inertiajs/react';
import { ToastContainer, toast, Bounce } from 'react-toastify';
import { PagePropsWithFlash } from '@/types';

type Faculty = {
  id: number;
  name: string;
};

type Department = {
  id: number;
  name: string;
};

interface Teacher {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  employee_id: string | number;
  faculty: Faculty;
  department: Department;
  title: string;
}

interface PasswordManagementPageProps {
  teacher?: Teacher;
  generatedPassword?: string;
}

const TeacherPasswordManagementPage = ({ teacher: initialTeacher, generatedPassword }: PasswordManagementPageProps) => {
  const [employeeId, setEmployeeId] = useState('');
  const [teacher, setTeacher] = useState<Teacher | null>(initialTeacher || null);
  const [isSearching, setIsSearching] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState(generatedPassword || '');
  const [copied, setCopied] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  console.log(newPassword);

  const { flash } = usePage().props as PagePropsWithFlash;

  useEffect(() => {
    if (flash?.success) {
      toast.success(flash.success, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
        transition: Bounce,
      });
    }
    if (flash?.error) {
      toast.error(flash.error, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
        transition: Bounce,
      });
    }
  }, [flash?.success, flash?.error]);

  const handleSearch = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    
    if (!employeeId.trim()) {
      toast.warning('Please enter an employee ID', {
        position: "top-right",
        autoClose: 3000,
        theme: "dark",
        transition: Bounce,
      });
      return;
    }

    setIsSearching(true);
    
    router.get(route('admin.teachers.password-management'), 
      { id: teacher?.id },
      {
        preserveState: true,
        onSuccess: (page: any) => {
          setIsSearching(false);
          if (page.props.teacher) {
            setTeacher(page.props.teacher);
            setNewPassword('');
          } else {
            setTeacher(null);
            toast.error('No teacher found with this employee ID', {
              position: "top-right",
              autoClose: 3000,
              theme: "dark",
              transition: Bounce,
            });
          }
        },
        onError: () => {
          setIsSearching(false);
          setTeacher(null);
        }
      }
    );
  };

  const handleResetPassword = () => {
    if (!teacher) return;

    if (confirm(`Are you sure you want to reset the password for ${teacher.title} ${teacher.first_name} ${teacher.last_name}?`)) {
      setIsResetting(true);
      
      router.post(route('admin.teachers.reset-password', teacher.id), {}, {
        preserveState: true,
        onSuccess: (page: any) => {
          setIsResetting(false);
          if (page.props.generatedPassword) {
            setNewPassword(page.props.generatedPassword);
            setShowPassword(true);
          }
        },
        onError: () => {
          setIsResetting(false);
        }
      });
    }
  };

  const copyToClipboard = async () => {
    if (newPassword) {
      try {
        await navigator.clipboard.writeText(newPassword);
        setCopied(true);
        toast.success('Password copied to clipboard!', {
          position: "top-right",
          autoClose: 2000,
          theme: "dark",
          transition: Bounce,
        });
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        toast.error('Failed to copy password', {
          position: "top-right",
          autoClose: 2000,
          theme: "dark",
          transition: Bounce,
        });
      }
    }
  };

  const clearSearch = () => {
    setEmployeeId('');
    setTeacher(null);
    setNewPassword('');
    setShowPassword(false);
  };

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
      title: 'Password Management',
      href: '/admin/teachers/password-management',
    }
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Teacher Password Management" />
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
            <div className="max-w-4xl mx-auto">
              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="p-3 bg-gradient-to-r from-indigo-600 to-purple-700 rounded-xl">
                    <Lock className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    Teacher Password Management
                  </h2>
                </div>
                <p className="text-slate-600 dark:text-slate-400 ml-[60px]">
                  Search for teachers and reset their passwords securely
                </p>
              </div>

              {/* Search Section */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 mb-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Search Teacher
                </h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Enter employee ID..."
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSearch(e);
                        }
                      }}
                      className="pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white w-full transition-shadow dark:placeholder-slate-400"
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 sm:w-auto w-full"
                  >
                    {isSearching ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>Searching...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-5 h-5" />
                        <span>Search</span>
                      </>
                    )}
                  </button>
                  {teacher && (
                    <button
                      onClick={clearSearch}
                      className="px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors sm:w-auto w-full"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Teacher Details Section */}
              {teacher && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
                  <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xl font-semibold">
                          {teacher.first_name[0] + teacher.last_name[0]}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                          {`${teacher.title} ${teacher.first_name} ${teacher.last_name}`}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {teacher.email}
                        </p>
                      </div>
                      <div className="hidden sm:flex items-center space-x-2 text-green-600 dark:text-green-400">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">Found</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Employee ID
                        </label>
                        <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                          {teacher.employee_id}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Phone
                        </label>
                        <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                          {teacher.phone}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Faculty
                        </label>
                        <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                          {teacher.faculty.name}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Department
                        </label>
                        <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                          {teacher.department.name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl mb-6">
                      <div className="flex items-start space-x-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                            Security Notice
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                            Resetting the password will generate a new secure password. Make sure to save it and provide it to the teacher.
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleResetPassword}
                      disabled={isResetting}
                      className="w-full px-6 py-3 bg-gradient-to-r from-red-600 to-pink-700 hover:from-red-700 hover:to-pink-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                      {isResetting ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          <span>Resetting Password...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-5 h-5" />
                          <span>Reset Password</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* New Password Display */}
              {newPassword && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 animate-fadeIn">
                  <div className="flex items-center space-x-3 mb-4">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      Password Reset Successful
                    </h3>
                  </div>
                  
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 mb-4">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                      New Password
                    </label>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          readOnly
                          className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white font-mono text-sm"
                        />
                      </div>
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-3 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={copyToClipboard}
                        className="p-3 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                        title="Copy to clipboard"
                      >
                        {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      <strong>Important:</strong> Please save this password and provide it to the teacher securely. 
                      They should change it after their first login.
                    </p>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!teacher && !isSearching && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    No Teacher Selected
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    Enter an employee ID above to search for a teacher and manage their password.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </AppLayout>
  );
};

export default TeacherPasswordManagementPage;