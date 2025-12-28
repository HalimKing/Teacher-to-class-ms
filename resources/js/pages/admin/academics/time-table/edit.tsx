// resources/js/pages/Admin/SchoolManagement/TimeTables/Edit.tsx
import React, { useState, useEffect } from 'react';
import { Save, ArrowLeft, Clock, AlertCircle, Users, Calendar, Building, BookOpen } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, useForm, router } from '@inertiajs/react';
import { ToastContainer, toast, Bounce } from 'react-toastify';
import TextField from '@mui/material/TextField';
import ComboBox from '@/components/combobox';

interface AcademicYear {
  id: number;
  name: string;
  start_year: number;
  end_year: number;
}

interface Course {
  id: number;
  name: string;
  course_code: string;
  teacher?: Teacher;
}

interface ClassRoom {
  id: number;
  name: string;
  capacity: number;
}

interface Teacher {
  id: number;
  first_name: string;
  last_name: string;
  employee_id: string;
  full_name?: string;
}

interface TimeTable {
  id: number;
  academic_year_id: number;
  course_id: number;
  class_room_id: number;
  day: string;
  start_time: string;
  end_time: string;
  academic_year: AcademicYear;
  course: Course;
  class_room: ClassRoom;
}

interface EditTimeTablePageProps {
  timeTable: TimeTable;
  academicYear: AcademicYear;
  courses: Option[];
  classRooms: Option[];
  days: string[];
  currentCourse: Option | null;
  currentClassRoom: Option | null;
}

interface Option {
  label: string;
  value: string;
  teacher?: Teacher;
  academic_year_id?: number;
}

const daysOptions: Option[] = [
  { label: 'Monday', value: 'Monday' },
  { label: 'Tuesday', value: 'Tuesday' },
  { label: 'Wednesday', value: 'Wednesday' },
  { label: 'Thursday', value: 'Thursday' },
  { label: 'Friday', value: 'Friday' },
  { label: 'Saturday', value: 'Saturday' },
  { label: 'Sunday', value: 'Sunday' },
];

const EditTimeTablePage = ({
  timeTable,
  academicYear,
  courses,
  classRooms,
  days,
  currentCourse,
  currentClassRoom
}: EditTimeTablePageProps) => {
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictMessage, setConflictMessage] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<Option | null>(currentCourse);

  const { data, setData, put, processing, errors } = useForm({
    academic_year_id: timeTable.academic_year_id,
    course_id: timeTable.course_id.toString(),
    class_room_id: timeTable.class_room_id.toString(),
    day: timeTable.day,
    start_time: timeTable.start_time.split(':').join(':').substring(0,5),
    end_time: timeTable.end_time.split(':').join(':').substring(0,5),
  });

  // Handle course selection
  const handleCourseChange = (value: string | number | undefined) => {
    const courseId = value?.toString() || '';
    setData('course_id', courseId);
    
    // Update selected course details
    const course = courses.find(c => c.value === courseId) || null;
    setSelectedCourse(course);
  };

  const handleValueChange = (name: keyof Omit<typeof data, 'course_id'>) => (value: string | number | undefined) => {
    setData(name, value as string);
  };

  // Check for time conflicts whenever relevant fields change
  useEffect(() => {
    const checkConflict = async () => {
      // Check both classroom and teacher conflicts
      if (data.academic_year_id && data.class_room_id && data.day && data.start_time && data.end_time && data.course_id) {
        setCheckingConflict(true);
        try {
          const response = await fetch('/api/time-tables/check-conflict', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              academic_year_id: data.academic_year_id,
              course_id: data.course_id,
              class_room_id: data.class_room_id,
              day: data.day,
              start_time: data.start_time,
              end_time: data.end_time,
              exclude_id: timeTable.id, // Exclude current record
            }),
          });
          
          const result = await response.json();
          setHasConflict(result.has_conflict);
          
          if (result.has_conflict) {
            if (result.conflict_type === 'teacher') {
              setConflictMessage(
                `The teacher assigned to this course already has a scheduled class during this time slot on ${data.day}.`
              );
            } else if (result.conflict_type === 'classroom') {
              setConflictMessage(
                `This time slot conflicts with an existing schedule for ${result.classroom_name || 'the selected classroom'} on ${data.day}.`
              );
            } else if (result.conflict_type === 'both') {
              setConflictMessage(
                `This time slot conflicts with both the teacher's schedule and the classroom availability on ${data.day}.`
              );
            } else {
              setConflictMessage('This time slot conflicts with an existing schedule.');
            }
          } else {
            setConflictMessage('');
          }
        } catch (error) {
          console.error('Error checking conflict:', error);
        } finally {
          setCheckingConflict(false);
        }
      }
    };

    // Debounce the conflict check
    const timeoutId = setTimeout(checkConflict, 500);
    return () => clearTimeout(timeoutId);
  }, [
    timeTable.id,
    data.academic_year_id, 
    data.course_id,
    data.class_room_id, 
    data.day, 
    data.start_time, 
    data.end_time
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (hasConflict) {
      toast.error('Please resolve the time conflict before saving.', {
        position: "top-right",
        theme: "dark",
      });
      return;
    }
    
    // Validate course selection
    if (!data.course_id) {
      toast.error('Please select a course.', {
        position: "top-right",
        theme: "dark",
      });
      return;
    }
    
    put(route('admin.academics.time-tables.update', timeTable.id));
  };

  // Breadcrumbs
  const breadcrumbs = [
    {
      title: 'Dashboard',
      href: '/admin/dashboard',
    },
    {
      title: 'Time Tables',
      href: '/admin/academics/time-tables',
    },
    {
      title: `Edit Time Slot (ID: ${timeTable.id})`,
      href: `/admin/academics/time-tables/${timeTable.id}/edit`,
    }
  ];

  // Format time for display
  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Get teacher from selected course
  const getSelectedTeacher = () => {
    if (!selectedCourse || !selectedCourse.teacher) return null;
    return selectedCourse.teacher;
  };

  const selectedTeacher = getSelectedTeacher();

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Edit Time Slot" />
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <Link
              href={route('admin.academics.time-tables.index')}
              className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-6"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Time Tables
            </Link>
            <h1 className="text-3xl font-extrabold text-slate-900">Edit Time Slot</h1>
            <p className="text-slate-600 mt-2">Update the schedule details</p>
          </div>

          {/* Current Details Summary */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 mb-6 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <h2 className="text-lg font-bold text-slate-900">Current Details</h2>
              <p className="text-slate-600 text-sm">This is what the schedule currently looks like</p>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-slate-500">Day</p>
                    <p className="font-semibold text-slate-900">{timeTable.day}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl">
                  <Clock className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-xs text-slate-500">Time</p>
                    <p className="font-semibold text-slate-900">
                      {formatTime(timeTable.start_time)} - {formatTime(timeTable.end_time)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl">
                  <BookOpen className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="text-xs text-slate-500">Course</p>
                    <p className="font-semibold text-slate-900">{timeTable.course.name}</p>
                    <p className="text-xs text-slate-500">{timeTable.course.course_code}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl">
                  <Building className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="text-xs text-slate-500">Classroom</p>
                    <p className="font-semibold text-slate-900">{timeTable.class_room.name}</p>
                    <p className="text-xs text-slate-500">Capacity: {timeTable.class_room.capacity}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="text-xs text-slate-500">Teacher</p>
                    <p className="font-semibold text-slate-900">
                      {timeTable.course.teacher 
                        ? `${timeTable.course.teacher.first_name} ${timeTable.course.teacher.last_name}`
                        : 'Not assigned'
                      }
                    </p>
                    {timeTable.course.teacher && (
                      <p className="text-xs text-slate-500">{timeTable.course.teacher.employee_id}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Academic Year</p>
                    <p className="font-semibold text-slate-900">{academicYear.name}</p>
                    <p className="text-xs text-slate-500">
                      {academicYear.start_year} - {academicYear.end_year}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Edit Form */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50">
              <h2 className="text-xl font-bold text-slate-900">Update Time Slot Details</h2>
              <p className="text-slate-600 mt-1">Modify the details for this time slot</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Academic Year */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Academic Year *
                </label>
                <span className='bg-purple-700 p-2 rounded-2xl text-white text-sm'>
                  {academicYear.name}
                </span>
              </div>

              {/* Course */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Course *
                  {selectedCourse?.teacher && (
                    <span className="ml-2 text-xs text-green-600 font-normal">
                      (Teacher: {selectedCourse.teacher.full_name || `${selectedCourse.teacher.first_name} ${selectedCourse.teacher.last_name}`})
                    </span>
                  )}
                </label>
                <div>
                  <ComboBox
                    options={courses}
                    label="Select Course"
                    externalValue={handleCourseChange}
                    defaultValue={currentCourse}
                  />
                  {errors.course_id && (
                    <p className="mt-2 text-sm text-red-500 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {errors.course_id}
                    </p>
                  )}
                  {selectedCourse?.teacher && (
                    <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                      <div className="flex items-center">
                        <Users className="w-4 h-4 text-green-600 mr-2" />
                        <div>
                          <p className="text-sm font-medium text-green-800">
                            Teacher assigned to this course: {selectedCourse.teacher.full_name || `${selectedCourse.teacher.first_name} ${selectedCourse.teacher.last_name}`}
                          </p>
                          <p className="text-xs text-green-600">
                            Employee ID: {selectedCourse.teacher.employee_id}
                          </p>
                          <p className="text-xs text-green-600 mt-1">
                            Note: The teacher will be automatically assigned based on the course selection.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {selectedCourse && !selectedCourse.teacher && (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="flex items-center">
                        <AlertCircle className="w-4 h-4 text-amber-600 mr-2" />
                        <div>
                          <p className="text-sm font-medium text-amber-800">
                            No teacher assigned to this course
                          </p>
                          <p className="text-xs text-amber-600">
                            You can assign a teacher to this course from the course management page.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Classroom */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Classroom *
                </label>
                <div>
                  <ComboBox
                    options={classRooms}
                    label="Select Classroom"
                    externalValue={handleValueChange('class_room_id')}
                    defaultValue={currentClassRoom}
                  />
                  {errors.class_room_id && (
                    <p className="mt-2 text-sm text-red-500 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {errors.class_room_id}
                    </p>
                  )}
                </div>
              </div>

              {/* Day */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Day *
                </label>
                <div>
                  <ComboBox
                    options={daysOptions}
                    label="Select Day"
                    externalValue={handleValueChange('day')}
                    defaultValue={daysOptions.find(d => d.value === timeTable.day) || null}
                  />
                  {errors.day && (
                    <p className="mt-2 text-sm text-red-500 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {errors.day}
                    </p>
                  )}
                </div>
              </div>

              {/* Time Slot */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Start Time *
                  </label>
                  <div className="relative">
                    <TextField
                      type="time"
                      name="start_time"
                      placeholder='Start time'
                      value={data.start_time}
                      onChange={(e) => setData('start_time', e.target.value)}
                      fullWidth
                      error={!!errors.start_time}
                      helperText={errors.start_time}
                      slotProps={{
                        input: {
                          className: 'w-full',
                        },
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    End Time *
                  </label>
                  <div className="relative">
                    <TextField
                      type="time"
                      name="end_time"
                      placeholder='End time'
                      value={data.end_time}
                      onChange={(e) => setData('end_time', e.target.value)}
                      fullWidth
                      error={!!errors.end_time}
                      helperText={errors.end_time}
                      slotProps={{
                        input: {
                          className: 'w-full',
                        },
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Conflict Warning */}
              {checkingConflict ? (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
                    <span className="text-blue-700">Checking for time conflicts...</span>
                  </div>
                </div>
              ) : hasConflict && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-red-800 font-medium">Time Conflict Detected!</p>
                      <p className="text-red-700 text-sm mt-1">{conflictMessage}</p>
                      <p className="text-red-600 text-xs mt-2">
                        Please adjust the time, classroom, or day to resolve the conflict.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Teacher Assignment Info */}
              {selectedTeacher && !hasConflict && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center">
                    <Users className="w-5 h-5 text-green-600 mr-3 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-green-800 font-medium">Teacher Assignment</p>
                      <p className="text-green-700 text-sm mt-1">
                        This time slot will be assigned to: {selectedTeacher.full_name || `${selectedTeacher.first_name} ${selectedTeacher.last_name}`}
                      </p>
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        <div className="text-green-600">
                          <span className="font-medium">Employee ID:</span> {selectedTeacher.employee_id}
                        </div>
                        <div className="text-green-600">
                          <span className="font-medium">Course:</span> {selectedCourse?.label?.split('(')[0]?.trim()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Duration Preview */}
              {data.start_time && data.end_time && !hasConflict && !selectedTeacher && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-800 font-medium">Time Slot Details</p>
                      <p className="text-blue-700 text-sm">
                        {(() => {
                          const start = new Date(`2000-01-01T${data.start_time}`);
                          const end = new Date(`2000-01-01T${data.end_time}`);
                          const diffMs = end.getTime() - start.getTime();
                          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                          const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                          
                          if (diffHours === 0) {
                            return `${diffMinutes} minutes`;
                          } else if (diffMinutes === 0) {
                            return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
                          }
                          return `${diffHours}h ${diffMinutes}m`;
                        })()}
                      </p>
                    </div>
                    <div className="text-blue-600 text-right">
                      <div>
                        {formatTime(data.start_time)} - {formatTime(data.end_time)}
                      </div>
                      {!selectedTeacher && (
                        <div className="text-blue-500 text-xs mt-1">
                          No teacher assigned to this course
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex items-center justify-end space-x-4 pt-6 border-t border-slate-200">
                <Link
                  href={route('admin.academics.time-tables.index')}
                  className="px-6 py-3 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                  disabled={processing}
                >
                  Cancel
                </Link>
                
                {/* Update button */}
                <button
                  type="submit"
                  disabled={processing || hasConflict}
                  className={`px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 text-white font-medium rounded-xl transition-all duration-200 flex items-center ${
                    processing || hasConflict
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:from-indigo-700 hover:to-purple-800 shadow-md hover:shadow-lg'
                  }`}
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      Update Time Slot
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <ToastContainer />
    </AppLayout>
  );
};

export default EditTimeTablePage;