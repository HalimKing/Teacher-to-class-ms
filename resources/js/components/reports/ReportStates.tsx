import { AlertTriangle, Loader2 } from 'lucide-react';

export function ReportLoadingState({ message = 'Loading report data...' }: { message?: string }) {
    return (
        <div className="flex h-full items-center justify-center p-8">
            <div className="text-center">
                <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-500" />
                <p className="text-sidebar-foreground/60">{message}</p>
            </div>
        </div>
    );
}

export function ReportErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
    return (
        <div className="flex h-full items-center justify-center p-8">
            <div className="text-center">
                <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-red-500" />
                <p className="text-red-600">{error}</p>
                <button onClick={onRetry} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                    Retry
                </button>
            </div>
        </div>
    );
}

export function ReportEmptyState({ message = 'No records match the selected filters.' }: { message?: string }) {
    return <div className="p-10 text-center text-sidebar-foreground/60">{message}</div>;
}
