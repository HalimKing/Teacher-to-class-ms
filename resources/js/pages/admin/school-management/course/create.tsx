import ComboBox from '@/components/combobox';
import AppLayout from '@/layouts/app-layout';
import { Head, useForm } from '@inertiajs/react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { AlertCircle } from 'lucide-react';
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

interface FormErrors {
    [key: string]: string;
}

interface Option {
    label: string;
    value: number | string;
}

interface CreateCoursePageProps {
    programOptions: Option[];
    levelOptions: Option[];
    academicYearOptions: Option[];
    academicPeriodOptions: Option[];
    teacherOptions: Option[];
}

const CreateCoursePage = ({ programOptions, levelOptions, academicYearOptions, academicPeriodOptions, teacherOptions }: CreateCoursePageProps) => {
    const initialFormState: FormData = {
        name: '',
        course_code: '',
        program: 0,
        level: 0,
        academic_year: 0,
        academic_period: 0,
        student_size: 0,
        credit_hours: 3, // Default value for credit hours
        teacher_id: 0,
        course_type: 'core',
    };

    const { data, setData, post, errors, processing } = useForm(initialFormState);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;

        // Handle numeric fields
        if (name === 'student_size' || name === 'credit_hours') {
            setData(name as any, parseInt(value) || 0);
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
        post(route('admin.school-management.courses.store'));
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
            title: 'Create Course',
            href: '/admin/school-management/course/create',
        },
    ];

    const courseTypeOptions = [
        { label: 'Core', value: 'core' },
        { label: 'Elective', value: 'elective' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Course" />

            <div className="min-h-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-5xl">
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-lg">
                        <div className="border-b border-slate-200 p-6">
                            <h1 className="text-2xl font-bold text-slate-900">Create New Course</h1>
                            <p className="mt-1 text-sm text-slate-500">Fill in the details to create a new course.</p>
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
                                        defaultValue={null}
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
                                        defaultValue={null}
                                    />
                                    {errors.course_type && (
                                        <p className="mt-2 flex items-center text-sm text-red-500">
                                            <AlertCircle className="mr-1 h-4 w-4" />
                                            {errors.course_type}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Teacher Selection */}
                            <div>
                                <ComboBox
                                    options={teacherOptions}
                                    label="Select Teacher (Optional)"
                                    externalValue={handleValueChange('teacher_id')}
                                    defaultValue={null}
                                />
                                {errors.teacher_id && (
                                    <p className="mt-2 flex items-center text-sm text-red-500">
                                        <AlertCircle className="mr-1 h-4 w-4" />
                                        {errors.teacher_id}
                                    </p>
                                )}
                                <p className="mt-1 text-sm text-slate-500">Assign a teacher to this course (optional)</p>
                            </div>

                            {/* Level, Academic Year, and Academic Period - Three Columns */}
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                                {/* Level */}
                                <div>
                                    <ComboBox
                                        options={levelOptions}
                                        label="Select Level"
                                        externalValue={handleValueChange('level')}
                                        defaultValue={null}
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
                                        defaultValue={null}
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
                                        defaultValue={null}
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

                            <div className="flex justify-end space-x-4 border-t pt-6">
                                <Button
                                    type="submit"
                                    color="primary"
                                    variant="contained"
                                    disabled={processing}
                                    className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white hover:from-indigo-700 hover:to-purple-800"
                                >
                                    {processing ? 'Creating...' : 'Create Course'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};

export default CreateCoursePage;
