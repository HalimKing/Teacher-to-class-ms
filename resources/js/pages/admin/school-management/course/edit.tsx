import ComboBox from '@/components/combobox';
import AppLayout from '@/layouts/app-layout';
import { Head, useForm } from '@inertiajs/react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { AlertCircle, User } from 'lucide-react';
import React, { useState } from 'react';

interface FormData {
    name: string;
    course_code: string;
    program: number;
    level?: number;
    academic_year?: number;
    academic_period?: number;
    student_size?: number;
    credit_hours?: number;
    teacher_id?: number;
    course_type: string;
}

type Course = {
    id: number;
    name: string;
    course_code: string;
    program_id: number;
    level_id?: number;
    academic_year_id?: number;
    academic_period_id?: number;
    student_size?: number;
    credit_hours?: number;
    teacher_id?: number;
    course_type: string;
    teacher?: Teacher;
};

interface Teacher {
    id: number;
    first_name: string;
    last_name: string;
    employee_id?: string;
    full_name?: string;
}

interface FormErrors {
    [key: string]: string;
}

interface Option {
    label: string;
    value: number | string;
}

interface PageProps {
    programOptions: Option[];
    levelOptions: Option[];
    academicYearOptions: Option[];
    academicPeriodOptions: Option[];
    teacherOptions: Option[];
    course: Course;
}

const EditCoursePage = ({ programOptions, levelOptions, academicYearOptions, academicPeriodOptions, teacherOptions, course }: PageProps) => {
    const initialFormState: FormData = {
        name: course.name,
        course_code: course.course_code,
        program: course.program_id,
        level: course.level_id || 0,
        academic_year: course.academic_year_id || 0,
        academic_period: course.academic_period_id || 0,
        student_size: course.student_size || 0,
        credit_hours: course.credit_hours || 0,
        teacher_id: course.teacher_id || 0,
        course_type: course.course_type || 'core',
    };

    const { data, setData, put, errors, processing } = useForm(initialFormState);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;

        // Handle numeric fields
        if (name === 'student_size' || name === 'credit_hours') {
            setData(name as any, parseInt(value) || 0);
        } else if (name === 'course_type') {
            setData(name as any, value);
        } else {
            setData(name as any, value);
        }
    };

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setData(name as any, value);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        put(route('admin.school-management.courses.update', course.id));
    };

    const handleValueChange = (name: string) => (value: string | number | undefined) => {
        setData(name as any, value as any);
    };

    const breadcrumbs = [
        {
            title: 'Dashboard',
            href: '/admin/dashboard',
        },
        {
            title: 'Courses',
            href: '/admin/school-management/courses',
        },
        {
            title: 'Edit Course',
            href: `/admin/school-management/courses/${course.id}/edit`,
        },
    ];

    const courseTypeOptions = [
        { label: 'Core', value: 'core' },
        { label: 'Elective', value: 'elective' },
    ];

    // Helper function to find the current option for dropdowns
    const findCurrentOption = (options: Option[], value?: number | string) => {
        if (!value) return null;
        return options.find((option) => option.value === value) || null;
    };

    // Get current teacher option
    const currentTeacherOption = course.teacher_id ? teacherOptions.find((option) => option.value === course.teacher_id) || null : null;

    // Get selected teacher details
    const selectedTeacher = teacherOptions.find((teacher) => teacher.value === data.teacher_id);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Edit Course" />

            <div className="min-h-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-5xl">
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-lg">
                        <div className="border-b border-slate-200 p-6">
                            <h1 className="text-2xl font-bold text-slate-900">Edit Course</h1>
                            <p className="mt-1 text-sm text-slate-500">Update the course details.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6 p-6">
                            {/* Course Code and Name - Two Columns */}
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div>
                                    <TextField
                                        label="Course Code"
                                        type="text"
                                        name="course_code"
                                        value={data.course_code}
                                        placeholder="e.g CSS 302"
                                        onChange={handleInputChange}
                                        fullWidth
                                        error={!!errors.course_code}
                                        helperText={errors.course_code}
                                        variant="outlined"
                                    />
                                </div>
                                <div>
                                    <TextField
                                        label="Course Name"
                                        type="text"
                                        name="name"
                                        placeholder="e.g Introduction to Web Development"
                                        value={data.name}
                                        onChange={handleInputChange}
                                        fullWidth
                                        error={!!errors.name}
                                        helperText={errors.name}
                                        variant="outlined"
                                    />
                                </div>
                            </div>

                            {/* Program and Course Type - Two Columns */}
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div>
                                    <ComboBox
                                        options={programOptions}
                                        label="Select Program"
                                        externalValue={handleValueChange('program')}
                                        defaultValue={findCurrentOption(programOptions, course.program_id)}
                                    />

                                    {errors.program && (
                                        <p className="mt-2 flex items-center text-sm text-red-500">
                                            <AlertCircle className="mr-1 h-4 w-4" />
                                            {errors.program}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <ComboBox
                                        options={courseTypeOptions}
                                        label="Select Course Type"
                                        externalValue={handleValueChange('course_type')}
                                        defaultValue={findCurrentOption(courseTypeOptions, data.course_type)}
                                    />

                                    {errors.course_type && (
                                        <p className="mt-2 flex items-center text-sm text-red-500">
                                            <AlertCircle className="mr-1 h-4 w-4" />
                                            {errors.course_type}
                                        </p>
                                    )}
                                    <p className="mt-1 text-sm text-slate-500">Core courses are mandatory, elective courses are optional</p>
                                </div>
                            </div>

                            {/* Teacher Selection */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                    Teacher (Optional)
                                    {selectedTeacher && (
                                        <span className="ml-2 text-xs font-normal text-green-600">Currently: {selectedTeacher.label}</span>
                                    )}
                                </label>
                                <ComboBox
                                    options={teacherOptions}
                                    label="Select Teacher"
                                    externalValue={handleValueChange('teacher_id')}
                                    defaultValue={currentTeacherOption}
                                />
                                {errors.teacher_id && (
                                    <p className="mt-2 flex items-center text-sm text-red-500">
                                        <AlertCircle className="mr-1 h-4 w-4" />
                                        {errors.teacher_id}
                                    </p>
                                )}
                                <p className="mt-1 flex items-center text-sm text-slate-500">
                                    <User className="mr-1 h-3 w-3" />
                                    Assign a teacher to this course (optional)
                                </p>

                                {/* Current Teacher Information */}
                                {course.teacher && (
                                    <div className="mt-2 rounded-xl border border-green-200 bg-green-50 p-3">
                                        <div className="flex items-center">
                                            <User className="mr-2 h-4 w-4 text-green-600" />
                                            <div>
                                                <p className="text-sm font-medium text-green-800">
                                                    Current teacher: {course.teacher.first_name} {course.teacher.last_name}
                                                </p>
                                                {course.teacher.employee_id && (
                                                    <p className="text-xs text-green-600">Employee ID: {course.teacher.employee_id}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Level, Academic Year, and Academic Period - Three Columns */}
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                                {/* Level */}
                                <div>
                                    <ComboBox
                                        options={levelOptions}
                                        label="Select Level"
                                        externalValue={handleValueChange('level')}
                                        defaultValue={findCurrentOption(levelOptions, course.level_id)}
                                    />
                                    {errors.level && (
                                        <p className="mt-2 flex items-center text-sm text-red-500">
                                            <AlertCircle className="mr-1 h-4 w-4" />
                                            {errors.level}
                                        </p>
                                    )}
                                </div>

                                {/* Academic Year */}
                                <div>
                                    <ComboBox
                                        options={academicYearOptions}
                                        label="Select Academic Year"
                                        externalValue={handleValueChange('academic_year')}
                                        defaultValue={findCurrentOption(academicYearOptions, course.academic_year_id)}
                                    />
                                    {errors.academic_year && (
                                        <p className="mt-2 flex items-center text-sm text-red-500">
                                            <AlertCircle className="mr-1 h-4 w-4" />
                                            {errors.academic_year}
                                        </p>
                                    )}
                                </div>

                                {/* Academic Period */}
                                <div>
                                    <ComboBox
                                        options={academicPeriodOptions}
                                        label="Select Academic Period"
                                        externalValue={handleValueChange('academic_period')}
                                        defaultValue={findCurrentOption(academicPeriodOptions, course.academic_period_id)}
                                    />
                                    {errors.academic_period && (
                                        <p className="mt-2 flex items-center text-sm text-red-500">
                                            <AlertCircle className="mr-1 h-4 w-4" />
                                            {errors.academic_period}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Student Size and Credit Hours - Two Columns */}
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                {/* Student Size Field */}
                                <div>
                                    <TextField
                                        label="Student Size"
                                        type="number"
                                        name="student_size"
                                        value={data.student_size}
                                        placeholder="e.g 50"
                                        onChange={handleInputChange}
                                        fullWidth
                                        error={!!errors.student_size}
                                        helperText={errors.student_size}
                                        variant="outlined"
                                        InputProps={{
                                            inputProps: {
                                                min: 0,
                                                step: 1,
                                            },
                                        }}
                                    />
                                    <p className="mt-1 text-sm text-slate-500">Maximum number of students allowed in this course</p>
                                </div>

                                {/* Credit Hours Field */}
                                <div>
                                    <TextField
                                        label="Credit Hours"
                                        type="number"
                                        name="credit_hours"
                                        value={data.credit_hours}
                                        placeholder="e.g 3"
                                        onChange={handleInputChange}
                                        fullWidth
                                        error={!!errors.credit_hours}
                                        helperText={errors.credit_hours}
                                        variant="outlined"
                                        InputProps={{
                                            inputProps: {
                                                min: 1,
                                                max: 10,
                                                step: 1,
                                            },
                                        }}
                                    />
                                    <p className="mt-1 text-sm text-slate-500">Number of credit hours for this course (typically 1-6)</p>
                                </div>
                            </div>

                            {/* Course Summary Preview */}
                            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                                <h3 className="mb-3 text-lg font-medium text-blue-800">Course Summary</h3>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div>
                                        <p className="text-sm text-blue-700">
                                            <span className="font-medium">Course:</span> {data.name}
                                        </p>
                                        <p className="text-sm text-blue-700">
                                            <span className="font-medium">Code:</span> {data.course_code}
                                        </p>
                                        <p className="text-sm text-blue-700">
                                            <span className="font-medium">Type:</span>{' '}
                                            {data.course_type === 'core' ? 'Core (Mandatory)' : 'Elective (Optional)'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-blue-700">
                                            <span className="font-medium">Student Capacity:</span> {data.student_size || 'Not set'}
                                        </p>
                                        <p className="text-sm text-blue-700">
                                            <span className="font-medium">Credit Hours:</span> {data.credit_hours || 'Not set'}
                                        </p>
                                        <p className="text-sm text-blue-700">
                                            <span className="font-medium">Teacher:</span> {selectedTeacher ? selectedTeacher.label : 'Not assigned'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end space-x-4 border-t pt-6">
                                <Button
                                    type="submit"
                                    color="primary"
                                    variant="contained"
                                    disabled={processing}
                                    className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white hover:from-orange-600 hover:to-yellow-600"
                                >
                                    {processing ? 'Updating...' : 'Update Course'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};

export default EditCoursePage;
