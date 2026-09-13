import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Loader2, Search, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';

export type RecipientOption = {
    id: number;
    name: string;
    meta?: string | null;
};

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
        <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <p className="text-sm font-medium text-sidebar-foreground">{label}</p>
                    {description && <p className="mt-0.5 text-xs text-sidebar-foreground/60">{description}</p>}
                </div>
                {selectedCount > 0 && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="text-xs font-medium text-sidebar-foreground/70 underline-offset-2 hover:underline"
                    >
                        Clear selected
                    </button>
                )}
            </div>

            {selectedItems.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {selectedItems.map((item) => (
                        <Badge key={item.id} variant="secondary" className="max-w-full gap-1 rounded-full px-2.5 py-1 text-xs font-medium">
                            <span className="truncate">{item.name}</span>
                            <button
                                type="button"
                                onClick={() => onToggle(item.id)}
                                className="rounded-full p-0.5 hover:bg-black/5 dark:hover:bg-white/10"
                                aria-label={`Remove ${item.name}`}
                            >
                                <X className="size-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}

            <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-sidebar-foreground/40" />
                <Input
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        onSearch(event.target.value);
                    }}
                    placeholder={placeholder}
                    className="h-11 bg-background pl-9 text-base md:text-sm"
                />
            </div>

            <div className="max-h-44 overflow-y-auto rounded-lg border border-sidebar-border/70 bg-background sm:max-h-56">
                {loading ? (
                    <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-sidebar-foreground/60">
                        <Loader2 className="size-4 animate-spin" />
                        Loading recipients...
                    </div>
                ) : visibleItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                            <Users className="size-4 text-sidebar-foreground/50" />
                        </div>
                        <p className="text-sm font-medium text-sidebar-foreground">No matching recipients</p>
                        <p className="text-xs text-sidebar-foreground/60">Try another name, employee ID, or unit.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-sidebar-border/60">
                        {visibleItems.map((item) => {
                            const checked = selectedIds.includes(item.id);

                            return (
                                <li key={item.id}>
                                    <label
                                        className={cn(
                                            'flex min-h-11 cursor-pointer items-start gap-3 px-3 py-3 transition-colors hover:bg-muted/60',
                                            checked && 'bg-primary/5',
                                        )}
                                    >
                                        <Checkbox
                                            checked={checked}
                                            onCheckedChange={() => onToggle(item.id)}
                                            className="mt-0.5"
                                        />
                                        <span className="min-w-0">
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
