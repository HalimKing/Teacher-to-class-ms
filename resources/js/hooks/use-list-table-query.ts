import { buildListQueryParams, listQueryParamsEqual, type FilterRecord } from '@/lib/list-filters';
import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

interface UseListTableQueryOptions {
    url: string;
    filters: FilterRecord;
    serverFilters: FilterRecord;
    sortBy: string;
    sortDir: 'asc' | 'desc';
    perPage: number;
    only?: string[];
}

export function useListTableQuery({
    url,
    filters,
    serverFilters,
    sortBy,
    sortDir,
    perPage,
    only,
}: UseListTableQueryOptions) {
    const [loading, setLoading] = useState(false);
    const skipInitialFetch = useRef(true);

    useEffect(() => {
        const removeStart = router.on('start', () => setLoading(true));
        const removeFinish = router.on('finish', () => setLoading(false));

        return () => {
            removeStart();
            removeFinish();
        };
    }, []);

    const visit = (params: Record<string, string>) => {
        router.get(url, params, {
            preserveState: true,
            replace: true,
            preserveScroll: true,
            only,
        });
    };

    useEffect(() => {
        const nextParams = buildListQueryParams(filters, {
            sortBy,
            sortDir,
            perPage,
            page: 1,
        });

        const currentParams = buildListQueryParams(serverFilters, {
            sortBy: serverFilters.sort_by || sortBy,
            sortDir: serverFilters.sort_dir === 'desc' ? 'desc' : 'asc',
            perPage: Number(serverFilters.per_page || perPage),
            page: 1,
        });

        if (skipInitialFetch.current) {
            skipInitialFetch.current = false;
            if (listQueryParamsEqual(nextParams, currentParams)) {
                return;
            }
        }

        if (listQueryParamsEqual(nextParams, currentParams)) {
            return;
        }

        const timeoutId = setTimeout(() => visit(nextParams), 400);

        return () => clearTimeout(timeoutId);
    }, [filters, sortBy, sortDir, perPage, url]);

    const onPageChange = (page: number) => {
        visit(
            buildListQueryParams(filters, {
                sortBy,
                sortDir,
                perPage,
                page,
            }),
        );
    };

    return { loading, onPageChange };
}
