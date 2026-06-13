import { Download, Printer } from 'lucide-react';

interface ReportExportButtonsProps {
    canExport: boolean;
    onExport: (format: 'xlsx' | 'csv' | 'pdf' | 'print') => void;
}

export function ReportExportButtons({ canExport, onExport }: ReportExportButtonsProps) {
    if (!canExport) return null;

    return (
        <div className="flex flex-wrap gap-2">
            <button onClick={() => onExport('xlsx')} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-800">
                <Download className="h-4 w-4" /> Excel
            </button>
            <button onClick={() => onExport('csv')} className="inline-flex items-center gap-2 rounded-lg border border-sidebar-border px-3 py-2 text-sm hover:bg-sidebar-accent">
                <Download className="h-4 w-4" /> CSV
            </button>
            <button onClick={() => onExport('pdf')} className="inline-flex items-center gap-2 rounded-lg border border-sidebar-border px-3 py-2 text-sm hover:bg-sidebar-accent">
                <Download className="h-4 w-4" /> PDF
            </button>
            <button onClick={() => onExport('print')} className="inline-flex items-center gap-2 rounded-lg border border-sidebar-border px-3 py-2 text-sm hover:bg-sidebar-accent">
                <Printer className="h-4 w-4" /> Print
            </button>
        </div>
    );
}
