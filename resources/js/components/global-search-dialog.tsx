import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { apiJsonRequest, getApiErrorMessage } from '@/lib/http';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import {
    BookOpen,
    Building2,
    CalendarDays,
    ClipboardCheck,
    GraduationCap,
    Landmark,
    LayoutGrid,
    LifeBuoy,
    Loader2,
    MapPin,
    Search,
    UserCog,
    Users,
    Clock,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

type SearchItem = {
    id: string;
    title: string;
    subtitle: string | null;
    url: string;
    meta: string | null;
};

type SearchGroup = {
    key: string;
    label: string;
    icon: string;
    items: SearchItem[];
};

type SearchCategory = {
    value: string;
    label: string;
};

type SearchResponse = {
    success: boolean;
    data: {
        groups: SearchGroup[];
        categories: SearchCategory[];
    };
};

type FlatResult = SearchItem & {
    groupKey: string;
    groupLabel: string;
    icon: string;
};

type RecentSearch = {
    id: string;
    title: string;
    subtitle?: string | null;
    url: string;
};

const RECENT_KEY = 'global-search-recent';
const RECENT_LIMIT = 8;
const DEBOUNCE_MS = 300;

const ICON_MAP: Record<string, LucideIcon> = {
    users: Users,
    'book-open': BookOpen,
    'map-pin': MapPin,
    calendar: CalendarDays,
    building: Building2,
    landmark: Landmark,
    'graduation-cap': GraduationCap,
    'life-buoy': LifeBuoy,
    'clipboard-check': ClipboardCheck,
    'user-cog': UserCog,
    layout: LayoutGrid,
};

function getIcon(name: string): LucideIcon {
    return ICON_MAP[name] ?? Search;
}

function loadRecent(): RecentSearch[] {
    try {
        const raw = localStorage.getItem(RECENT_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw) as RecentSearch[];
        return Array.isArray(parsed) ? parsed.slice(0, RECENT_LIMIT) : [];
    } catch {
        return [];
    }
}

function saveRecent(item: RecentSearch) {
    const next = [item, ...loadRecent().filter((entry) => entry.id !== item.id)].slice(0, RECENT_LIMIT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

function clearRecent() {
    localStorage.removeItem(RECENT_KEY);
}

function highlightText(text: string, query: string) {
    const q = query.trim();
    if (!q) {
        return text;
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

    return parts.map((part, index) =>
        part.toLowerCase() === q.toLowerCase() ? (
            <mark key={`${part}-${index}`} className="rounded-sm bg-amber-200/80 px-0.5 text-inherit dark:bg-amber-500/30">
                {part}
            </mark>
        ) : (
            <span key={`${part}-${index}`}>{part}</span>
        ),
    );
}

export function GlobalSearchDialog() {
    const listId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [category, setCategory] = useState('all');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [groups, setGroups] = useState<SearchGroup[]>([]);
    const [categories, setCategories] = useState<SearchCategory[]>([{ value: 'all', label: 'All' }]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [recent, setRecent] = useState<RecentSearch[]>([]);

    const flatResults = useMemo<FlatResult[]>(
        () =>
            groups.flatMap((group) =>
                group.items.map((item) => ({
                    ...item,
                    groupKey: group.key,
                    groupLabel: group.label,
                    icon: group.icon,
                })),
            ),
        [groups],
    );

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setOpen(true);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    useEffect(() => {
        if (!open) {
            return;
        }

        setRecent(loadRecent());
        const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
        return () => window.clearTimeout(timer);
    }, [open]);

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const controller = new AbortController();
        const isQueryEmpty = debouncedQuery === '';

        if (!isQueryEmpty) {
            setLoading(true);
            setError(null);
        } else {
            setGroups([]);
            setLoading(false);
            setError(null);
            setActiveIndex(0);
        }

        const params = new URLSearchParams({
            q: debouncedQuery,
            category,
        });

        apiJsonRequest<SearchResponse>(`/search?${params.toString()}`, {
            method: 'GET',
            signal: controller.signal,
        })
            .then((payload) => {
                if (!isQueryEmpty) {
                    setGroups(payload.data.groups ?? []);
                    setActiveIndex(0);
                }
                setCategories(
                    payload.data.categories?.length
                        ? payload.data.categories
                        : [{ value: 'all', label: 'All' }],
                );
            })
            .catch((err) => {
                if (controller.signal.aborted) {
                    return;
                }
                if (!isQueryEmpty) {
                    setGroups([]);
                    setError(getApiErrorMessage(err, 'Search failed. Please try again.'));
                }
            })
            .finally(() => {
                if (!controller.signal.aborted && !isQueryEmpty) {
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, [open, debouncedQuery, category]);

    const navigateTo = (item: Pick<SearchItem, 'id' | 'title' | 'subtitle' | 'url'>) => {
        saveRecent({
            id: item.id,
            title: item.title,
            subtitle: item.subtitle,
            url: item.url,
        });
        setRecent(loadRecent());
        setOpen(false);
        setQuery('');
        setDebouncedQuery('');
        setGroups([]);
        router.visit(item.url);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            return;
        }

        const list = flatResults.length > 0 ? flatResults : recent.map((entry) => ({
            ...entry,
            subtitle: entry.subtitle ?? null,
            meta: null,
            groupKey: 'recent',
            groupLabel: 'Recent',
            icon: 'layout',
        }));

        if (list.length === 0) {
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % list.length);
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((index) => (index - 1 + list.length) % list.length);
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            const selected = list[activeIndex];
            if (selected) {
                navigateTo(selected);
            }
        }
    };

    const showRecent = debouncedQuery === '' && !loading;
    const hasResults = flatResults.length > 0;
    const showEmpty = debouncedQuery !== '' && !loading && !error && !hasResults;

    return (
        <>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="group h-9 w-9 cursor-pointer"
                onClick={() => setOpen(true)}
                aria-label="Open global search"
            >
                <Search className="!size-5 opacity-80 group-hover:opacity-100" />
            </Button>

            <Dialog
                open={open}
                onOpenChange={(next) => {
                    setOpen(next);
                    if (!next) {
                        setQuery('');
                        setDebouncedQuery('');
                        setGroups([]);
                        setError(null);
                        setCategory('all');
                        setActiveIndex(0);
                    }
                }}
            >
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Global search</DialogTitle>
                        <DialogDescription>Search staff, courses, schedules, help desk, and more.</DialogDescription>
                    </DialogHeader>

                    <div className="flex items-center gap-2 border-b px-3 py-2">
                        <Search className="size-4 shrink-0 text-muted-foreground" />
                        <Input
                            ref={inputRef}
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={onKeyDown}
                            placeholder="Search staff, courses, venues, tickets…"
                            className="h-10 border-0 shadow-none focus-visible:ring-0"
                            role="combobox"
                            aria-expanded={open}
                            aria-controls={listId}
                            aria-autocomplete="list"
                            autoComplete="off"
                        />
                        {loading ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : null}
                        <kbd className="hidden shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
                            Esc
                        </kbd>
                    </div>

                    <div className="flex gap-1.5 overflow-x-auto border-b px-3 py-2">
                        {categories.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => {
                                    setCategory(item.value);
                                    setActiveIndex(0);
                                }}
                                className={cn(
                                    'shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                    category === item.value
                                        ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                                        : 'bg-muted text-muted-foreground hover:bg-muted/80',
                                )}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <div id={listId} role="listbox" className="max-h-[min(60vh,28rem)] overflow-y-auto p-2">
                        {error ? (
                            <p className="px-3 py-8 text-center text-sm text-destructive">{error}</p>
                        ) : null}

                        {showRecent ? (
                            recent.length > 0 ? (
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between px-2 py-1">
                                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent</p>
                                        <button
                                            type="button"
                                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                            onClick={() => {
                                                clearRecent();
                                                setRecent([]);
                                            }}
                                        >
                                            <X className="size-3" />
                                            Clear
                                        </button>
                                    </div>
                                    {recent.map((item, index) => {
                                        const Icon = Clock;
                                        const active = activeIndex === index;
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                role="option"
                                                aria-selected={active}
                                                className={cn(
                                                    'flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors',
                                                    active ? 'bg-muted' : 'hover:bg-muted/70',
                                                )}
                                                onMouseEnter={() => setActiveIndex(index)}
                                                onClick={() => navigateTo(item)}
                                            >
                                                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-medium">{item.title}</span>
                                                    {item.subtitle ? (
                                                        <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                                                    ) : null}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                                    Type to search across the app. Use ↑ ↓ Enter, or press Esc to close.
                                </p>
                            )
                        ) : null}

                        {hasResults
                            ? groups.map((group) => {
                                  const Icon = getIcon(group.icon);
                                  return (
                                      <div key={group.key} className="mb-2">
                                          <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                              {group.label}
                                          </p>
                                          <div className="space-y-0.5">
                                              {group.items.map((item) => {
                                                  const flatIndex = flatResults.findIndex((entry) => entry.id === item.id);
                                                  const active = flatIndex === activeIndex;
                                                  return (
                                                      <button
                                                          key={item.id}
                                                          type="button"
                                                          role="option"
                                                          aria-selected={active}
                                                          className={cn(
                                                              'flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors',
                                                              active ? 'bg-muted' : 'hover:bg-muted/70',
                                                          )}
                                                          onMouseEnter={() => setActiveIndex(flatIndex)}
                                                          onClick={() => navigateTo(item)}
                                                      >
                                                          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                                          <span className="min-w-0 flex-1">
                                                              <span className="block truncate text-sm font-medium">
                                                                  {highlightText(item.title, debouncedQuery)}
                                                              </span>
                                                              {item.subtitle ? (
                                                                  <span className="block truncate text-xs text-muted-foreground">
                                                                      {highlightText(item.subtitle, debouncedQuery)}
                                                                  </span>
                                                              ) : null}
                                                              {item.meta ? (
                                                                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground/80">
                                                                      {item.meta}
                                                                  </span>
                                                              ) : null}
                                                          </span>
                                                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                                                              {group.label}
                                                          </span>
                                                      </button>
                                                  );
                                              })}
                                          </div>
                                      </div>
                                  );
                              })
                            : null}

                        {showEmpty ? (
                            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                                No results found for “{debouncedQuery}”.
                            </p>
                        ) : null}

                        {loading && debouncedQuery !== '' && !hasResults ? (
                            <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
                                <Loader2 className="size-4 animate-spin" />
                                Searching…
                            </div>
                        ) : null}
                    </div>

                    <div className="flex items-center justify-between border-t px-3 py-2 text-[11px] text-muted-foreground">
                        <span>↑↓ navigate · Enter open · Esc close</span>
                        <span className="hidden sm:inline">Ctrl/⌘ K</span>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
