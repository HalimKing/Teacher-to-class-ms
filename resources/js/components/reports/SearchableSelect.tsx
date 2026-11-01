import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface SearchableSelectOption {
    value: string;
    label: string;
    meta?: string | null;
    keywords?: string;
}

interface SearchableSelectProps {
    value: string;
    options: SearchableSelectOption[];
    onChange: (value: string) => void;
    /** Shown as the first option and when `value` matches it. Pass null to disable. */
    allOption?: SearchableSelectOption | null;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
    className?: string;
    disabled?: boolean;
}

function normalize(value: string): string {
    return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function SearchableSelect({
    value,
    options,
    onChange,
    allOption = { value: 'all', label: 'All' },
    placeholder = 'Select...',
    searchPlaceholder = 'Type to search...',
    emptyMessage = 'No matches found.',
    className,
    disabled = false,
}: SearchableSelectProps) {
    const listboxId = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlighted, setHighlighted] = useState(0);

    const allOptions = useMemo(() => (allOption ? [allOption, ...options] : options), [allOption, options]);
    const selected = allOptions.find((option) => option.value === value) ?? null;
    const isAllSelected = allOption ? value === allOption.value : false;

    const filtered = useMemo(() => {
        const needle = normalize(query);
        if (!needle) return allOptions;

        const terms = needle.split(' ');
        return allOptions.filter((option) => {
            if (allOption && option.value === allOption.value) return true;
            const haystack = normalize([option.label, option.meta ?? '', option.keywords ?? ''].join(' '));
            return terms.every((term) => haystack.includes(term));
        });
    }, [allOptions, allOption, query]);

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('touchstart', handlePointerDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('touchstart', handlePointerDown);
        };
    }, [open]);

    useEffect(() => {
        if (open) {
            setQuery('');
            const selectedIndex = Math.max(
                0,
                allOptions.findIndex((option) => option.value === value),
            );
            setHighlighted(selectedIndex);
            window.requestAnimationFrame(() => searchRef.current?.focus());
        }
    }, [open, allOptions, value]);

    useEffect(() => {
        setHighlighted(0);
    }, [query]);

    useEffect(() => {
        if (!open) return;
        const item = listRef.current?.querySelector<HTMLElement>(`[data-index="${highlighted}"]`);
        item?.scrollIntoView({ block: 'nearest' });
    }, [highlighted, open]);

    const choose = (option: SearchableSelectOption) => {
        onChange(option.value);
        setOpen(false);
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlighted((index) => Math.min(index + 1, filtered.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlighted((index) => Math.max(index - 1, 0));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const option = filtered[highlighted];
            if (option) choose(option);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
        } else if (event.key === 'Tab') {
            setOpen(false);
        }
    };

    return (
        <div ref={containerRef} className={cn('relative', className)}>
            <button
                type="button"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listboxId}
                onClick={() => setOpen((current) => !current)}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setOpen(true);
                    }
                }}
                className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg border border-sidebar-border/50 bg-white px-3 py-2 text-left text-sm text-sidebar-foreground transition dark:bg-sidebar-accent',
                    'focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none',
                    open && 'border-indigo-500 ring-4 ring-indigo-500/10',
                    disabled && 'cursor-not-allowed opacity-60',
                )}
            >
                <span className="min-w-0 flex-1">
                    {selected ? (
                        <span className="flex min-w-0 items-baseline gap-1.5">
                            <span className="truncate">{selected.label}</span>
                            {selected.meta && !isAllSelected && (
                                <span className="shrink-0 text-xs text-sidebar-foreground/55">{selected.meta}</span>
                            )}
                        </span>
                    ) : (
                        <span className="text-sidebar-foreground/50">{placeholder}</span>
                    )}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                    {allOption && !isAllSelected && !disabled && (
                        <span
                            role="button"
                            tabIndex={-1}
                            aria-label="Clear selection"
                            onClick={(event) => {
                                event.stopPropagation();
                                onChange(allOption.value);
                            }}
                            className="flex size-5 items-center justify-center rounded-full text-sidebar-foreground/50 hover:bg-muted hover:text-sidebar-foreground"
                        >
                            <X className="size-3.5" />
                        </span>
                    )}
                    <ChevronsUpDown className="size-4 text-sidebar-foreground/50" />
                </span>
            </button>

            {open && (
                <div
                    className="absolute left-0 z-50 mt-1.5 w-full min-w-[16rem] overflow-hidden rounded-xl border border-sidebar-border/70 bg-white shadow-lg dark:bg-sidebar-accent"
                    onKeyDown={handleKeyDown}
                >
                    <div className="relative border-b border-sidebar-border/60 p-2">
                        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-sidebar-foreground/40" />
                        <input
                            ref={searchRef}
                            type="text"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={searchPlaceholder}
                            role="combobox"
                            aria-expanded={open}
                            aria-controls={listboxId}
                            aria-autocomplete="list"
                            className="w-full rounded-lg border border-transparent bg-muted/50 py-2 pr-3 pl-8 text-sm text-sidebar-foreground outline-none placeholder:text-sidebar-foreground/45 focus:border-indigo-400 focus:bg-white dark:focus:bg-sidebar-accent"
                        />
                    </div>

                    <ul ref={listRef} id={listboxId} role="listbox" className="max-h-64 overflow-y-auto p-1">
                        {filtered.length === 0 ? (
                            <li className="px-3 py-6 text-center text-sm text-sidebar-foreground/60">{emptyMessage}</li>
                        ) : (
                            filtered.map((option, index) => {
                                const isSelected = option.value === value;
                                const isHighlighted = index === highlighted;
                                const isAll = allOption ? option.value === allOption.value : false;

                                return (
                                    <li
                                        key={option.value}
                                        data-index={index}
                                        role="option"
                                        aria-selected={isSelected}
                                        onMouseEnter={() => setHighlighted(index)}
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => choose(option)}
                                        className={cn(
                                            'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm',
                                            isHighlighted ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100' : 'text-sidebar-foreground',
                                            isAll && 'font-medium',
                                        )}
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate">{option.label}</span>
                                            {option.meta && !isAll && (
                                                <span className="block truncate text-xs text-sidebar-foreground/55">{option.meta}</span>
                                            )}
                                        </span>
                                        {isSelected && <Check className="size-4 shrink-0 text-indigo-600" />}
                                    </li>
                                );
                            })
                        )}
                    </ul>

                    {filtered.length > 0 && query && (
                        <div className="border-t border-sidebar-border/60 px-3 py-1.5 text-[11px] text-sidebar-foreground/50">
                            {filtered.length - (allOption ? 1 : 0)} of {options.length} shown
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
