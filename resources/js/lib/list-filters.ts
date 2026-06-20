export type FilterRecord = Record<string, string | undefined>;

const METADATA_KEYS = new Set(['sort_by', 'sort_dir', 'per_page', 'page']);

export function buildListQueryParams(
    filters: FilterRecord,
    options: {
        sortBy: string;
        sortDir: 'asc' | 'desc';
        perPage: number;
        page?: number;
    },
): Record<string, string> {
    const params: Record<string, string> = {};

    Object.entries(filters).forEach(([key, value]) => {
        if (METADATA_KEYS.has(key)) {
            return;
        }

        if (value && value !== 'all') {
            params[key] = value;
        }
    });

    params.sort_by = options.sortBy;
    params.sort_dir = options.sortDir;
    params.per_page = String(options.perPage);

    if (options.page !== undefined) {
        params.page = String(options.page);
    }

    return params;
}

export function listQueryParamsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
    const normalize = (params: Record<string, string>) =>
        JSON.stringify(
            Object.keys(params)
                .sort()
                .reduce<Record<string, string>>((acc, key) => {
                    acc[key] = params[key];
                    return acc;
                }, {}),
        );

    return normalize(a) === normalize(b);
}

export function simpleFilterParamsEqual(
    local: Record<string, string>,
    server: Record<string, string | undefined>,
): boolean {
    const normalizedLocal: Record<string, string> = {};
    const normalizedServer: Record<string, string> = {};

    Object.entries(local).forEach(([key, value]) => {
        if (value) {
            normalizedLocal[key] = value;
        }
    });

    Object.entries(server).forEach(([key, value]) => {
        if (value) {
            normalizedServer[key] = value;
        }
    });

    return listQueryParamsEqual(normalizedLocal, normalizedServer);
}
