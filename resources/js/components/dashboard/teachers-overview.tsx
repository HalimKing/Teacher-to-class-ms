import { Building, MapPin, Search, Star } from 'lucide-react';
import { useMemo, useState } from 'react';

export interface TeacherOverview {
    id: number;
    name: string;
    initials: string;
    subject: string;
    faculty: string;
    department: string;
    status: string;
    statusTime: string;
    topic: string;
    room: string;
    rating: number | string;
    classes: number;
    avatar: string;
}

export default function TeachersOverview({ teachers }: { teachers: TeacherOverview[] }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [facultyFilter, setFacultyFilter] = useState('All Faculties');
    const [departmentFilter, setDepartmentFilter] = useState('All Departments');
    const [statusFilter, setStatusFilter] = useState('All Status');

    const allFaculties = useMemo(() => {
        const uniqueFaculties = [...new Set(teachers.map((teacher) => teacher.faculty))];
        return ['All Faculties', ...uniqueFaculties];
    }, [teachers]);

    const departments = useMemo(() => {
        if (facultyFilter === 'All Faculties') {
            const allDepartments = [...new Set(teachers.map((teacher) => teacher.department))];
            return ['All Departments', ...allDepartments];
        }

        const uniqueDepartments = [...new Set(teachers.filter((t) => t.faculty === facultyFilter).map((t) => t.department))];
        return ['All Departments', ...uniqueDepartments];
    }, [facultyFilter, teachers]);

    const statuses = useMemo(() => {
        const uniqueStatuses = [...new Set(teachers.map((teacher) => teacher.status))];
        return ['All Status', ...uniqueStatuses.map((status) => status.charAt(0).toUpperCase() + status.slice(1))];
    }, [teachers]);

    const filteredTeachers = useMemo(() => {
        return teachers.filter((teacher) => {
            const matchesSearch =
                teacher.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                teacher.subject.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesStatus = statusFilter === 'All Status' || teacher.status === statusFilter.toLowerCase();
            const matchesFaculty = facultyFilter === 'All Faculties' || teacher.faculty === facultyFilter;
            const matchesDepartment = departmentFilter === 'All Departments' || teacher.department === departmentFilter;

            return matchesSearch && matchesStatus && matchesFaculty && matchesDepartment;
        });
    }, [searchQuery, statusFilter, facultyFilter, departmentFilter, teachers]);

    return (
        <section className="rounded-xl border border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
            <div className="border-b border-sidebar-border/50 px-5 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-sidebar-foreground">Teachers Overview</h2>
                        <p className="text-sm text-sidebar-foreground/60">
                            Showing {filteredTeachers.length} of {teachers.length} lecturers
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-sidebar-foreground/60">
                        <Building className="size-4" aria-hidden="true" />
                        Filter by faculty, department, or status
                    </div>
                </div>
            </div>

            <div className="grid gap-3 border-b border-sidebar-border/50 px-5 py-4 md:grid-cols-4">
                <div className="relative md:col-span-1">
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-sidebar-foreground/50" aria-hidden="true" />
                    <input
                        type="text"
                        placeholder="Search teachers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-10 w-full rounded-lg border border-sidebar-border/50 bg-white pr-3 pl-10 text-sm text-sidebar-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none dark:bg-sidebar-accent"
                    />
                </div>
                <select
                    value={facultyFilter}
                    onChange={(e) => {
                        setFacultyFilter(e.target.value);
                        setDepartmentFilter('All Departments');
                    }}
                    className="h-10 rounded-lg border border-sidebar-border/50 bg-white px-3 text-sm dark:bg-sidebar-accent"
                >
                    {allFaculties.map((faculty) => (
                        <option key={faculty} value={faculty}>
                            {faculty}
                        </option>
                    ))}
                </select>
                <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="h-10 rounded-lg border border-sidebar-border/50 bg-white px-3 text-sm dark:bg-sidebar-accent"
                >
                    {departments.map((dept) => (
                        <option key={dept} value={dept}>
                            {dept}
                        </option>
                    ))}
                </select>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-10 rounded-lg border border-sidebar-border/50 bg-white px-3 text-sm dark:bg-sidebar-accent"
                >
                    {statuses.map((status) => (
                        <option key={status} value={status}>
                            {status}
                        </option>
                    ))}
                </select>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
                    <thead>
                        <tr className="border-b border-sidebar-border/30 bg-muted/20">
                            {['Teacher', 'Status', 'Faculty & Department', 'Room', 'Rating', 'Classes'].map((heading) => (
                                <th key={heading} className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                    {heading}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTeachers.length > 0 ? (
                            filteredTeachers.map((teacher) => (
                                <tr key={teacher.id} className="border-b border-sidebar-border/20 transition-colors last:border-b-0 hover:bg-muted/20">
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`relative flex size-10 items-center justify-center rounded-lg ${teacher.avatar} text-sm font-medium text-white`}>
                                                {teacher.initials}
                                                <span
                                                    className={`absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-white ${
                                                        teacher.status === 'teaching' ? 'bg-blue-500' : teacher.status === 'available' ? 'bg-emerald-500' : 'bg-gray-400'
                                                    }`}
                                                />
                                            </div>
                                            <div>
                                                <p className="font-medium text-sidebar-foreground">{teacher.name}</p>
                                                <p className="text-sm text-sidebar-foreground/60">{teacher.subject}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span
                                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                                                teacher.status === 'teaching'
                                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                                                    : teacher.status === 'available'
                                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400'
                                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                                            }`}
                                        >
                                            {teacher.status}
                                        </span>
                                        <p className="mt-1 text-xs text-sidebar-foreground/50">{teacher.statusTime}</p>
                                    </td>
                                    <td className="px-4 py-4">
                                        <p className="text-sm font-medium text-sidebar-foreground">{teacher.faculty}</p>
                                        <p className="text-xs text-sidebar-foreground/60">{teacher.department}</p>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-1 text-sm text-sidebar-foreground/70">
                                            <MapPin className="size-4" aria-hidden="true" />
                                            {teacher.room}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-1">
                                            <Star className="size-4 fill-current text-amber-400" aria-hidden="true" />
                                            <span>{teacher.rating}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-sidebar-foreground">{teacher.classes}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} className="px-4 py-10 text-center text-sm text-sidebar-foreground/50">
                                    No teachers found matching your criteria.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
