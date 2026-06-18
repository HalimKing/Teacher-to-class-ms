import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, FileText, Printer, Upload, X } from 'lucide-react';
import { type FormEvent } from 'react';

interface TeacherImportExportPanelProps {
    fileName: string | null;
    previewLoading: boolean;
    onFileChange: (file: File | null) => void;
    onPreview: (event: FormEvent) => void;
    onExport: (format: 'excel' | 'csv' | 'pdf' | 'print') => void;
}

export default function TeacherImportExportPanel({
    fileName,
    previewLoading,
    onFileChange,
    onPreview,
    onExport,
}: TeacherImportExportPanelProps) {
    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-white p-5 shadow-sm dark:bg-sidebar-accent">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-sidebar-foreground">Import & Export</h2>
                    <p className="text-sm text-sidebar-foreground/60">Bulk manage teacher records with templates and filtered exports.</p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                    <h3 className="text-sm font-medium text-sidebar-foreground">Export Data</h3>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => onExport('excel')}>
                            <FileSpreadsheet className="size-4" />
                            Excel
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => onExport('csv')}>
                            <FileText className="size-4" />
                            CSV
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => onExport('pdf')}>
                            <Download className="size-4" />
                            PDF
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => onExport('print')}>
                            <Printer className="size-4" />
                            Print
                        </Button>
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-sm font-medium text-sidebar-foreground">Import Data</h3>
                    <a
                        href={route('admin.teachers.template')}
                        className="inline-flex items-center gap-2 rounded-lg border border-sidebar-border/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/40"
                    >
                        <Download className="size-4" />
                        Download Template
                    </a>
                    <form onSubmit={onPreview} className="space-y-2">
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-sidebar-border/70 px-4 py-3 text-sm transition-colors hover:bg-muted/30">
                            <Upload className="size-4" />
                            <span className="flex-1 truncate">{fileName || 'Choose CSV or Excel file...'}</span>
                            <input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                className="hidden"
                                onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
                            />
                        </label>
                        <div className="flex gap-2">
                            {fileName && (
                                <Button type="button" variant="ghost" size="sm" onClick={() => onFileChange(null)}>
                                    <X className="size-4" />
                                    Clear
                                </Button>
                            )}
                            <Button type="submit" size="sm" disabled={previewLoading || !fileName}>
                                {previewLoading ? 'Previewing...' : 'Preview Import'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
