// resources/js/pages/Admin/SchoolManagement/TimeTables/Create.tsx
import ComboBox from '@/components/combobox';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import TextField from '@mui/material/TextField';
import { AlertCircle, ArrowLeft, Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';

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
}

interface ClassRoom {
    id: number;
    name: string;
    capacity: number;
}

interface Teacher {
    id: number;
    name: string;
    email: string;
    employee_id?: string;
}

interface CreateTimeTablePageProps {
    academicYear: AcademicYear;
    courses: Option[];
    classRooms: Option[];
    teachers: Option[]; // Add teachers prop
    days: string[];
}

interface Option {
    label: string;
    value: string;
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

const CreateTimeTablePage = ({ academicYear, courses, classRooms, days }: CreateTimeTablePageProps) => {
    const [checkingConflict, setCheckingConflict] = useState(false);
    const [hasConflict, setHasConflict] = useState(false);
    const [conflictMessage, setConflictMessage] = useState('');

    const { data, setData, post, processing, errors } = useForm({
        academic_year_id: academicYear.id,
        course_id: '',
        class_room_id: '',
        day: '',
        start_time: '',
        end_time: '',
        create_another: false,
    });

    const handleValueChange = (name: keyof typeof data) => (value: string | number | undefined) => {
        setData(name, value as string);
    };

    // Check for time conflicts whenever relevant fields change
    useEffect(() => {
        const checkConflict = async () => {
            // Check both classroom and teacher conflicts
            if (data.academic_year_id && data.class_room_id && data.day && data.start_time && data.end_time) {
                setCheckingConflict(true);
                try {
                    const response = await fetch('/api/time-tables/check-conflict', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                        },
                        body: JSON.stringify({
                            academic_year_id: data.academic_year_id,
                            class_room_id: data.class_room_id,
                            day: data.day,
                            start_time: data.start_time,
                            end_time: data.end_time,
                        }),
                    });

                    const result = await response.json();
                    setHasConflict(result.has_conflict);

                    if (result.has_conflict) {
                        if (result.conflict_type === 'classroom') {
                            setConflictMessage(
                                `This time slot conflicts with an existing schedule for ${result.classroom_name || 'the selected classroom'} on ${data.day}.`,
                            );
                        } else if (result.conflict_type === 'both') {
                            setConflictMessage(
                                `This time slot conflicts with both the teacher's schedule and the classroom availability on ${data.day}.`,
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
    }, [data.academic_year_id, data.class_room_id, data.day, data.start_time, data.end_time]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (hasConflict) {
            toast.error('Please resolve the time conflict before saving.', {
                position: 'top-right',
                theme: 'dark',
            });
            return;
        }

        // Make sure create_another is false for regular save
        setData('create_another', false);
        post(route('admin.academics.time-tables.store'));
    };

    const handleSaveAndAddAnother = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();

        if (hasConflict) {
            toast.error('Please resolve the time conflict before saving.', {
                position: 'top-right',
                theme: 'dark',
            });
            return;
        }

        // Submit with create_another = true and handle success/error callbacks
        setData('create_another', true);

        post(route('admin.academics.time-tables.store'), {
            onSuccess: () => {
                // Only reset form if the server indicates success
                // Reset form fields while keeping academic year
                setData({
                    academic_year_id: academicYear.id,
                    course_id: '',
                    class_room_id: '',
                    day: '',
                    start_time: '',
                    end_time: '',
                    create_another: false, // Reset for next use
                });
                setHasConflict(false);
                setConflictMessage('');

                toast.success('Time slot saved successfully! Ready for the next slot.', {
                    position: 'top-right',
                    theme: 'dark',
                });
            },
            onError: (errors) => {
                toast.error('Failed to save time slot. Please check the form.', {
                    position: 'top-right',
                    theme: 'dark',
                });
            },
        });
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
            title: 'Create Time Slot',
            href: '/admin/academics/time-tables/create',
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Time Slot" />
            <div className="min-h-screen bg-slate-50 py-8">
                <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                    <div className="mb-8">
                        <Link
                            href={route('admin.academics.time-tables.index')}
                            className="mb-6 inline-flex items-center text-slate-600 hover:text-slate-900"
                        >
                            <ArrowLeft className="mr-2 h-5 w-5" />
                            Back to Time Tables
                        </Link>
                        <h1 className="text-3xl font-extrabold text-slate-900">Create New Time Slot</h1>
                        <p className="mt-2 text-slate-600">Add a new schedule to the time table</p>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                        <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-6">
                            <h2 className="text-xl font-bold text-slate-900">Time Slot Details</h2>
                            <p className="mt-1 text-slate-600">Fill in the details for the new time slot</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6 p-6">
                            {/* Academic Year */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">Academic Year *</label>
                                <span className="rounded-2xl bg-purple-700 p-2 text-sm text-white">{academicYear.name}</span>
                            </div>

                            {/* Course */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">Course *</label>
                                <div>
                                    <ComboBox
                                        options={courses}
                                        label="Select Course"
                                        externalValue={handleValueChange('course_id')}
                                        defaultValue={null}
                                    />
                                    {errors.course_id && (
                                        <p className="mt-2 flex items-center text-sm text-red-500">
                                            <AlertCircle className="mr-1 h-4 w-4" />
                                            {errors.course_id}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Teacher (Optional) */}

                            {/* Classroom */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">Classroom *</label>
                                <div>
                                    <ComboBox
                                        options={classRooms}
                                        label="Select Classroom"
                                        externalValue={handleValueChange('class_room_id')}
                                        defaultValue={null}
                                    />
                                    {errors.class_room_id && (
                                        <p className="mt-2 flex items-center text-sm text-red-500">
                                            <AlertCircle className="mr-1 h-4 w-4" />
                                            {errors.class_room_id}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Day */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">Day *</label>
                                <div>
                                    <ComboBox options={daysOptions} label="Select Day" externalValue={handleValueChange('day')} defaultValue={null} />
                                    {errors.day && (
                                        <p className="mt-2 flex items-center text-sm text-red-500">
                                            <AlertCircle className="mr-1 h-4 w-4" />
                                            {errors.day}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Time Slot */}
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">Start Time *</label>
                                    <div className="relative">
                                        <TextField
                                            type="time"
                                            name="start_time"
                                            placeholder="Start time"
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
                                    <label className="mb-2 block text-sm font-medium text-slate-700">End Time *</label>
                                    <div className="relative">
                                        <TextField
                                            type="time"
                                            name="end_time"
                                            placeholder="End time"
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
                                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                                    <div className="flex items-center">
                                        <div className="mr-3 h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600"></div>
                                        <span className="text-blue-700">Checking for time conflicts...</span>
                                    </div>
                                </div>
                            ) : (
                                hasConflict && (
                                    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                                        <div className="flex items-start">
                                            <AlertCircle className="mt-0.5 mr-3 h-5 w-5 flex-shrink-0 text-red-600" />
                                            <div>
                                                <p className="font-medium text-red-800">Time Conflict Detected!</p>
                                                <p className="mt-1 text-sm text-red-700">{conflictMessage}</p>
                                                <p className="mt-2 text-xs text-red-600">
                                                    Please adjust the time, classroom, teacher, or day to resolve the conflict.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}

                            {/* Duration Preview */}
                            {data.start_time && data.end_time && !hasConflict && (
                                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-green-800">Time Slot Duration</p>
                                            <p className="text-sm text-green-700">
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
                                        <div className="text-right text-green-600">
                                            <div>
                                                {new Date(`2000-01-01T${data.start_time}`).toLocaleTimeString('en-US', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    hour12: true,
                                                })}{' '}
                                                -{' '}
                                                {new Date(`2000-01-01T${data.end_time}`).toLocaleTimeString('en-US', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    hour12: true,
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Form Actions */}
                            <div className="flex items-center justify-end space-x-4 border-t border-slate-200 pt-6">
                                <Link
                                    href={route('admin.academics.time-tables.index')}
                                    className="rounded-xl border border-slate-300 px-6 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                                    disabled={processing}
                                >
                                    Cancel
                                </Link>

                                {/* Save and Add Another button */}
                                <button
                                    type="button"
                                    onClick={handleSaveAndAddAnother}
                                    disabled={processing || hasConflict}
                                    className={`flex items-center rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 px-6 py-3 font-medium text-white transition-all duration-200 ${
                                        processing || hasConflict
                                            ? 'cursor-not-allowed opacity-50'
                                            : 'shadow-md hover:from-green-700 hover:to-emerald-800 hover:shadow-lg'
                                    }`}
                                >
                                    {processing ? (
                                        <>
                                            <div className="mr-2 h-5 w-5 animate-spin rounded-full border-b-2 border-white"></div>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 h-5 w-5" />
                                            Save and Add Another
                                        </>
                                    )}
                                </button>

                                {/* Regular Save button */}
                                <button
                                    type="submit"
                                    disabled={processing || hasConflict}
                                    className={`flex items-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-3 font-medium text-white transition-all duration-200 ${
                                        processing || hasConflict
                                            ? 'cursor-not-allowed opacity-50'
                                            : 'shadow-md hover:from-indigo-700 hover:to-purple-800 hover:shadow-lg'
                                    }`}
                                >
                                    {processing ? (
                                        <>
                                            <div className="mr-2 h-5 w-5 animate-spin rounded-full border-b-2 border-white"></div>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 h-5 w-5" />
                                            Save Time Slot
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

export default CreateTimeTablePage;
