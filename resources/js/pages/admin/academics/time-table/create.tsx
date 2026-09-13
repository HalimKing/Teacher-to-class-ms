// resources/js/pages/Admin/SchoolManagement/TimeTables/Create.tsx
import ComboBox from '@/components/combobox';
import AppLayout from '@/layouts/app-layout';
import { PagePropsWithFlash } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
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
    teachers: Array<Option & { staff_type?: string; employee_id?: string }>;
    staffTypeOptions: Option[];
    days: string[];
}

interface Option {
    label: string;
    value: string;
    employee_id?: string;
    staff_type?: string;
}

interface CreateTimeTableForm {
    academic_year_id: number;
    staff_type: string;
    teacher_id: string;
    course_id: string;
    class_room_id: string;
    day: string;
    days: string[];
    start_time: string;
    end_time: string;
    create_another: boolean;
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

const CreateTimeTablePage = ({ academicYear, courses, classRooms, teachers, staffTypeOptions, days }: CreateTimeTablePageProps) => {
    const [checkingConflict, setCheckingConflict] = useState(false);
    const [hasConflict, setHasConflict] = useState(false);
    const [conflictMessage, setConflictMessage] = useState('');
    const { flash } = usePage().props as PagePropsWithFlash;

    const { data, setData, post, processing, errors, transform } = useForm<CreateTimeTableForm>({
        academic_year_id: academicYear.id,
        staff_type: 'lecturer',
        teacher_id: '',
        course_id: '',
        class_room_id: '',
        day: '',
        days: [],
        start_time: '',
        end_time: '',
        create_another: false,
    });

    const handleValueChange = (name: keyof typeof data) => (value: string | number | undefined) => {
        setData(name, value as string);
    };

    const showFormErrorToast = (formErrors: Record<string, string>) => {
        const firstError = Object.values(formErrors)[0];
        toast.error(firstError || 'Failed to save time slot. Please check the form.', {
            position: 'top-right',
            theme: 'dark',
        });
    };

    const selectedDays = data.staff_type === 'administrator' ? data.days : data.day ? [data.day] : [];

    const handleAdministratorDayToggle = (day: string) => {
        setData(
            'days',
            data.days.includes(day)
                ? data.days.filter((selectedDay) => selectedDay !== day)
                : [...data.days, day],
        );
    };

    // Check for time conflicts whenever relevant fields change
    useEffect(() => {
        const checkConflict = async () => {
            if (data.staff_type === 'administrator') {
                setHasConflict(false);
                setConflictMessage('');
                setCheckingConflict(false);
                return;
            }

            // Check both classroom and teacher conflicts
            if (data.academic_year_id && data.teacher_id && selectedDays.length > 0 && data.start_time && data.end_time) {
                setCheckingConflict(true);
                try {
                    const results = await Promise.all(
                        selectedDays.map(async (day) => {
                            const response = await fetch('/api/time-tables/check-conflict', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    Accept: 'application/json',
                                    'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '',
                                },
                                body: JSON.stringify({
                                    academic_year_id: data.academic_year_id,
                                    staff_type: data.staff_type,
                                    teacher_id: data.teacher_id,
                                    course_id: data.course_id,
                                    class_room_id: data.class_room_id,
                                    day,
                                    start_time: data.start_time,
                                    end_time: data.end_time,
                                }),
                            });

                            return { day, result: await response.json() };
                        }),
                    );

                    const conflict = results.find(({ result }) => result.has_conflict);
                    setHasConflict(!!conflict);

                    if (conflict) {
                        const { day, result } = conflict;
                        if (result.conflict_type === 'classroom') {
                            setConflictMessage(
                                `This time slot conflicts with an existing schedule for ${result.classroom_name || 'the selected venue'} on ${day}.`,
                            );
                        } else if (result.conflict_type === 'both') {
                            setConflictMessage(
                                `This time slot conflicts with both the staff member's schedule and the venue availability on ${day}.`,
                            );
                        } else {
                            setConflictMessage(`This time slot conflicts with an existing schedule on ${day}.`);
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
    }, [data.academic_year_id, data.staff_type, data.teacher_id, data.course_id, data.class_room_id, data.day, data.days, data.start_time, data.end_time]);

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, {
                position: 'top-right',
                theme: 'dark',
            });
        }

        if (flash?.error) {
            toast.error(flash.error, {
                position: 'top-right',
                theme: 'dark',
            });
        }
    }, [flash?.success, flash?.error]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (hasConflict) {
            toast.error('Please resolve the time conflict before saving.', {
                position: 'top-right',
                theme: 'dark',
            });
            return;
        }

        transform((formData) => ({
            ...formData,
            create_another: false,
        }));

        post(route('admin.academics.time-tables.store'), {
            onError: showFormErrorToast,
        });
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

        transform((formData) => ({
            ...formData,
            create_another: true,
        }));

        post(route('admin.academics.time-tables.store'), {
            onSuccess: () => {
                // Only reset form if the server indicates success
                // Reset form fields while keeping academic year
                setData({
                    academic_year_id: academicYear.id,
                    staff_type: data.staff_type,
                    teacher_id: '',
                    course_id: '',
                    class_room_id: '',
                    day: '',
                    days: [],
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
            onError: showFormErrorToast,
        });
    };

    // Breadcrumbs
    const breadcrumbs = [
        {
            title: 'Dashboard',
            href: '/admin/dashboard',
        },
        {
            title: 'Assigned Schedules',
            href: '/admin/academics/time-tables',
        },
        {
            title: 'Create Schedule',
            href: '/admin/academics/time-tables/create',
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Schedule" />
            <div className="min-h-screen min-w-0 bg-slate-50 py-4 dark:bg-background sm:py-8">
                <div className="mx-auto max-w-4xl min-w-0 px-3 sm:px-6 lg:px-8">
                    <div className="mb-5 sm:mb-8">
                        <Link
                            href={route('admin.academics.time-tables.index')}
                            className="mb-3 inline-flex min-h-10 items-center text-sm text-slate-600 hover:text-slate-900 dark:text-sidebar-foreground/70 dark:hover:text-sidebar-foreground"
                        >
                            <ArrowLeft className="mr-2 h-5 w-5" />
                            Back to schedules
                        </Link>
                        <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-sidebar-foreground">Create Schedule</h1>
                        <p className="mt-2 text-sm text-slate-600 sm:text-base dark:text-sidebar-foreground/65">Add a new schedule assignment</p>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-sidebar-border dark:bg-card">
                        <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 sm:p-6 dark:border-sidebar-border dark:from-indigo-950/30 dark:to-purple-950/20">
                            <h2 className="text-lg font-bold text-slate-900 sm:text-xl dark:text-sidebar-foreground">Time Slot Details</h2>
                            <p className="mt-1 text-sm text-slate-600 dark:text-sidebar-foreground/65">Fill in the details for the new time slot</p>
                        </div>

                        <form onSubmit={handleSubmit} className="min-w-0 space-y-5 p-4 sm:space-y-6 sm:p-6">
                            {/* Academic Year */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">Academic Year *</label>
                                <span className="inline-flex max-w-full break-words rounded-2xl bg-purple-700 px-3 py-2 text-sm text-white">
                                    {academicYear.name}
                                </span>
                            </div>

                            {/* Course */}
                            <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
                                <div className="min-w-0">
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-sidebar-foreground">Staff Type *</label>
                                    <ComboBox
                                        options={staffTypeOptions}
                                        label="Select Staff Type"
                                        externalValue={(value) => {
                                            setData('staff_type', value as string);
                                            setData('teacher_id', '');
                                            if (value === 'administrator') {
                                                setData('course_id', '');
                                                setData('day', '');
                                            } else {
                                                setData('days', []);
                                            }
                                        }}
                                        defaultValue={staffTypeOptions.find((option) => option.value === data.staff_type) || staffTypeOptions[0]}
                                    />
                                    {errors.staff_type && (
                                        <p className="mt-2 flex items-center text-sm text-red-500">
                                            <AlertCircle className="mr-1 h-4 w-4" />
                                            {errors.staff_type}
                                        </p>
                                    )}
                                </div>

                                <div className="min-w-0">
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-sidebar-foreground">Assigned Staff *</label>
                                    <ComboBox
                                        options={teachers.filter((teacher) => !teacher.staff_type || teacher.staff_type === data.staff_type)}
                                        label="Assign Staff"
                                        externalValue={handleValueChange('teacher_id')}
                                        defaultValue={null}
                                    />
                                    {errors.teacher_id && (
                                        <p className="mt-2 flex items-center text-sm text-red-500">
                                            <AlertCircle className="mr-1 h-4 w-4" />
                                            {errors.teacher_id}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {data.staff_type === 'lecturer' && (
                                <div className="min-w-0">
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-sidebar-foreground">Course *</label>
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
                            )}

                            {/* Venue */}
                            <div className="min-w-0">
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-sidebar-foreground">Venue *</label>
                                <div>
                                    <ComboBox
                                        options={classRooms}
                                        label="Select Venue"
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
                            {data.staff_type === 'administrator' ? (
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">Days *</label>
                                    <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-3 sm:gap-3 sm:p-4 dark:border-sidebar-border">
                                        {daysOptions.map((day) => (
                                            <label key={day.value} className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-slate-700 dark:text-sidebar-foreground">
                                                <input
                                                    type="checkbox"
                                                    value={day.value}
                                                    checked={data.days.includes(day.value)}
                                                    onChange={() => handleAdministratorDayToggle(day.value)}
                                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span>{day.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                    {(errors.days || errors['days.0']) && (
                                        <p className="mt-2 flex items-center text-sm text-red-500">
                                            <AlertCircle className="mr-1 h-4 w-4" />
                                            {errors.days || errors['days.0']}
                                        </p>
                                    )}
                                    <p className="mt-2 text-xs text-slate-500">One schedule will be created for each selected day.</p>
                                </div>
                            ) : (
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
                            )}

                            {/* Time Slot */}
                            <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
                                <div className="min-w-0">
                                    <label htmlFor="start_time" className="mb-2 block text-sm font-medium text-slate-700 dark:text-sidebar-foreground">
                                        Start Time *
                                    </label>
                                    <input
                                        id="start_time"
                                        type="time"
                                        name="start_time"
                                        value={data.start_time}
                                        onChange={(e) => setData('start_time', e.target.value)}
                                        className="h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-background px-3 text-base text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 md:text-sm dark:border-sidebar-border dark:text-sidebar-foreground"
                                    />
                                    {errors.start_time && (
                                        <p className="mt-2 flex items-center text-sm text-red-500">
                                            <AlertCircle className="mr-1 h-4 w-4" />
                                            {errors.start_time}
                                        </p>
                                    )}
                                </div>

                                <div className="min-w-0">
                                    <label htmlFor="end_time" className="mb-2 block text-sm font-medium text-slate-700 dark:text-sidebar-foreground">
                                        End Time *
                                    </label>
                                    <input
                                        id="end_time"
                                        type="time"
                                        name="end_time"
                                        value={data.end_time}
                                        onChange={(e) => setData('end_time', e.target.value)}
                                        className="h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-background px-3 text-base text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 md:text-sm dark:border-sidebar-border dark:text-sidebar-foreground"
                                    />
                                    {errors.end_time && (
                                        <p className="mt-2 flex items-center text-sm text-red-500">
                                            <AlertCircle className="mr-1 h-4 w-4" />
                                            {errors.end_time}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Conflict Warning */}
                            {checkingConflict ? (
                                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                                    <div className="flex items-center">
                                        <div className="mr-3 h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600"></div>
                                        <span className="text-blue-700">Checking for time conflicts...</span>
                                    </div>
                                </div>
                            ) : (
                                hasConflict && (
                                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
                                        <div className="flex items-start">
                                            <AlertCircle className="mt-0.5 mr-3 h-5 w-5 flex-shrink-0 text-red-600" />
                                            <div>
                                                <p className="font-medium text-red-800">Time Conflict Detected!</p>
                                                <p className="mt-1 text-sm text-red-700">{conflictMessage}</p>
                                                <p className="mt-2 text-xs text-red-600">
                                                    Please adjust the time, venue, staff member, or day to resolve the conflict.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}

                            {/* Duration Preview */}
                            {data.start_time && data.end_time && !hasConflict && (
                                <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="font-medium text-green-800 dark:text-emerald-200">Time Slot Duration</p>
                                            <p className="text-sm text-green-700 dark:text-emerald-300">
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
                                        <div className="text-sm text-green-600 sm:text-right dark:text-emerald-300">
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
                            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:flex-wrap sm:justify-end dark:border-sidebar-border">
                                <Link
                                    href={route('admin.academics.time-tables.index')}
                                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-5 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-sidebar-border dark:text-sidebar-foreground dark:hover:bg-sidebar-accent"
                                >
                                    Cancel
                                </Link>

                                <button
                                    type="button"
                                    onClick={handleSaveAndAddAnother}
                                    disabled={processing || hasConflict}
                                    className={`inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 px-5 py-3 font-medium text-white transition-all duration-200 ${
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

                                <button
                                    type="submit"
                                    disabled={processing || hasConflict}
                                    className={`inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-700 px-5 py-3 font-medium text-white transition-all duration-200 ${
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
