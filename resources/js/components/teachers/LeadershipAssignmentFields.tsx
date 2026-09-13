import ComboBox from '@/components/combobox';
import { Shield } from 'lucide-react';
import { useEffect, useState } from 'react';

export const leadershipRoleOptions = [
    { label: 'None', value: '' },
    { label: 'Director/Dean', value: 'director_dean' },
    { label: 'Head of Department', value: 'head_of_department' },
];

interface DepartmentOption {
    label: string;
    value: string;
}

interface LeadershipAssignmentFieldsProps {
    role: string;
    facultyId: number | null;
    departmentId: number | null;
    errors?: {
        leadershipRole?: string;
        leadershipFaculty?: string;
        leadershipDepartment?: string;
    };
    onRoleChange: (value: string) => void;
    onDepartmentChange: (value: number | null) => void;
}

export default function LeadershipAssignmentFields({
    role,
    facultyId,
    departmentId,
    errors = {},
    onRoleChange,
    onDepartmentChange,
}: LeadershipAssignmentFieldsProps) {
    const [departmentOptions, setDepartmentOptions] = useState<DepartmentOption[]>([]);
    const showDepartment = role === 'head_of_department';
    const usesFaculty = role === 'director_dean' || role === 'head_of_department';

    useEffect(() => {
        if (!showDepartment || !facultyId) {
            setDepartmentOptions([]);
            return;
        }

        fetch(`/api/faculties/${facultyId}/departments`)
            .then((response) => response.json())
            .then((departments: Array<{ id: number; name: string }>) => {
                setDepartmentOptions(
                    departments.map((department) => ({
                        label: department.name,
                        value: department.id.toString(),
                    })),
                );
            })
            .catch(() => setDepartmentOptions([]));
    }, [facultyId, showDepartment]);

    const selectedRole = leadershipRoleOptions.find((option) => option.value === role) ?? leadershipRoleOptions[0];
    const selectedDepartment = departmentOptions.find((option) => option.value === departmentId?.toString()) ?? null;

    return (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h3 className="mb-2 flex items-center text-lg font-semibold text-slate-900 dark:text-white">
                <Shield className="mr-2 h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Leadership Assignment
            </h3>
            <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
                Optional extra responsibility. The staff member keeps every feature of their original lecturer or
                administrator role.
            </p>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                    <ComboBox
                        options={leadershipRoleOptions}
                        label="Leadership Role"
                        externalValue={(value) => onRoleChange(String(value ?? ''))}
                        defaultValue={selectedRole}
                    />
                    {errors.leadershipRole && <p className="mt-1 text-sm text-red-500">{errors.leadershipRole}</p>}
                    {usesFaculty && (
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Uses the Faculty selected above.
                            {!facultyId ? ' Select a faculty in Professional Information first.' : ''}
                        </p>
                    )}
                    {errors.leadershipFaculty && <p className="mt-1 text-sm text-red-500">{errors.leadershipFaculty}</p>}
                </div>
                {showDepartment && (
                    <div>
                        <ComboBox
                            options={departmentOptions}
                            label="Department"
                            externalValue={(value) => onDepartmentChange(value ? Number(value) : null)}
                            defaultValue={selectedDepartment}
                        />
                        {errors.leadershipDepartment && (
                            <p className="mt-1 text-sm text-red-500">{errors.leadershipDepartment}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
