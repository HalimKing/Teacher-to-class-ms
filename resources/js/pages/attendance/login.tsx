import { Head, useForm, usePage } from '@inertiajs/react';
import { Loader2, ScanLine } from 'lucide-react';

interface LoginPageProps {
    timeoutMinutes: number;
}

export default function AttendancePortalLoginPage({ timeoutMinutes }: LoginPageProps) {
    const { flash } = usePage().props as { flash?: { error?: string } };
    const { data, setData, post, processing, errors } = useForm({
        staff_id: '',
    });

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        post(route('attendance.login.submit'));
    };

    return (
        <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 px-4 py-10">
            <Head title="Attendance Portal" />

            <div className="w-full max-w-md">
                <div className="mb-8 text-center text-white">
                    <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-emerald-500/20 ring-1 ring-emerald-400/30">
                        <ScanLine className="size-8 text-emerald-300" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">Attendance Portal</h1>
                    <p className="mt-2 text-emerald-100/80">Enter your Staff ID to access attendance.</p>
                </div>

                <form
                    onSubmit={submit}
                    className="rounded-2xl border border-white/10 bg-white p-6 shadow-2xl shadow-black/20 dark:bg-slate-900 md:p-8"
                >
                    {(flash?.error || errors.staff_id) && (
                        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {errors.staff_id || flash?.error}
                        </div>
                    )}

                    <label htmlFor="staff_id" className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Staff ID
                    </label>
                    <input
                        id="staff_id"
                        name="staff_id"
                        type="text"
                        inputMode="text"
                        autoComplete="off"
                        autoFocus
                        placeholder="Enter your Staff ID"
                        value={data.staff_id}
                        onChange={(event) => setData('staff_id', event.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-4 text-lg tracking-wide text-slate-900 outline-none ring-emerald-500 focus:border-emerald-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />

                    <button
                        type="submit"
                        disabled={processing || !data.staff_id.trim()}
                        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {processing ? <Loader2 className="size-5 animate-spin" /> : null}
                        Continue
                    </button>

                    <p className="mt-4 text-center text-xs text-slate-500">
                        For attendance only. Session ends after {timeoutMinutes} minutes of inactivity.
                    </p>
                </form>

                <p className="mt-6 text-center text-xs text-emerald-100/60">
                    Use your employee ID exactly as issued by the institution.
                </p>
            </div>
        </div>
    );
}
