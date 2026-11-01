import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Check, Loader2, Search, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';

export type RecipientOption = {
    id: number;
    name: string;
    meta?: string | null;
};

function initialsFor(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
}

export function RecipientPicker({
    label,
    description,
    placeholder,
    items,
    selectedIds,
    selectedItems,
    loading = false,
    onToggle,
    onSearch,
    onClear,
}: {
    label: string;
    description?: string;
    placeholder: string;
    items: RecipientOption[];
    selectedIds: number[];
    selectedItems: RecipientOption[];
    loading?: boolean;
    onToggle: (id: number) => void;
    onSearch: (value: string) => void;
    onClear: () => void;
}) {
    const [query, setQuery] = useState('');
    const selectedCount = selectedIds.length;

    const visibleItems = useMemo(() => {
        const selected = new Set(selectedIds);
        return [...items].sort((a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id)));
    }, [items, selectedIds]);

    return (
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3 sm:p-4 dark:border-sidebar-border dark:bg-muted/20">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-sidebar-foreground">
                        {label}
                        {selectedCount > 0 && (
                            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                                {selectedCount}
                            </span>
                        )}
                    </p>
                    {description && <p className="mt-0.5 text-xs text-sidebar-foreground/60">{description}</p>}
                </div>
                {selectedCount > 0 && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-sidebar-foreground/70 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                    >
                        <X className="size-3" />
                        Clear all
                    </button>
                )}
            </div>

            {selectedItems.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedItems.map((item) => (
                        <span
                            key={item.id}
                            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 py-1 pr-1 pl-2.5 text-xs font-medium text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-100"
                        >
                            <span className="truncate">{item.name}</span>
                            <button
                                type="button"
                                onClick={() => onToggle(item.id)}
                                className="flex size-5 shrink-0 items-center justify-center rounded-full text-indigo-600 transition hover:bg-indigo-600 hover:text-white dark:text-indigo-200"
                                aria-label={`Remove ${item.name}`}
                            >
                                <X className="size-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            <div className="relative mt-3">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-sidebar-foreground/40" />
                <Input
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        onSearch(event.target.value);
                    }}
                    placeholder={placeholder}
                    className="h-11 rounded-xl border-slate-200 bg-background pl-10 text-base shadow-sm focus-visible:border-indigo-500 focus-visible:ring-4 focus-visible:ring-indigo-500/15 md:text-sm dark:border-sidebar-border"
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => {
                            setQuery('');
                            onSearch('');
                        }}
                        className="absolute top-1/2 right-2.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-sidebar-foreground/50 hover:bg-muted hover:text-sidebar-foreground"
                        aria-label="Clear search"
                    >
                        <X className="size-3.5" />
                    </button>
                )}
            </div>

            <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-slate-200/80 bg-background sm:max-h-64 dark:border-sidebar-border">
                {loading ? (
                    <div className="flex items-center justify-center gap-2 px-3 py-10 text-sm text-sidebar-foreground/60">
                        <Loader2 className="size-4 animate-spin" />
                        Loading recipients...
                    </div>
                ) : visibleItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                        <div className="flex size-11 items-center justify-center rounded-2xl bg-muted">
                            <Users className="size-5 text-sidebar-foreground/50" />
                        </div>
                        <p className="text-sm font-medium text-sidebar-foreground">No matching recipients</p>
                        <p className="text-xs text-sidebar-foreground/60">Try another name, employee ID, or unit.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-sidebar-border/60">
                        {visibleItems.map((item) => {
                            const checked = selectedIds.includes(item.id);

                            return (
                                <li key={item.id}>
                                    <label
                                        className={cn(
                                            'flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20',
                                            checked && 'bg-indigo-50/70 dark:bg-indigo-950/30',
                                        )}
                                    >
                                        <Checkbox checked={checked} onCheckedChange={() => onToggle(item.id)} />
                                        <span
                                            className={cn(
                                                'flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                                                checked
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-slate-100 text-slate-600 dark:bg-muted dark:text-sidebar-foreground/70',
                                            )}
                                        >
                                            {checked ? <Check className="size-3.5" /> : initialsFor(item.name) || <Users className="size-3.5" />}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-sidebar-foreground">{item.name}</span>
                                            {item.meta && <span className="mt-0.5 block truncate text-xs text-sidebar-foreground/55">{item.meta}</span>}
                                        </span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
