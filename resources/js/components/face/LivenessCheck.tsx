import { Loader2 } from 'lucide-react';

interface LivenessCheckProps {
    active: boolean;
}

export default function LivenessCheck({ active }: LivenessCheckProps) {
    if (!active) {
        return null;
    }

    return (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking whether you are physically present...
        </div>
    );
}
