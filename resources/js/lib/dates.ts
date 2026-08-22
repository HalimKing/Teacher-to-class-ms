const LONG_DATE_FORMAT: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
};

function parseDisplayDate(value: string): Date | null {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    const date = /^\d{4}-\d{2}-\d{2}/.test(trimmed)
        ? new Date(`${trimmed.slice(0, 10)}T00:00:00`)
        : new Date(trimmed.replace(' ', 'T'));

    return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLongDate(value?: string | null, empty = '—'): string {
    if (!value) {
        return empty;
    }

    const date = parseDisplayDate(value);
    if (!date) {
        return value;
    }

    return date.toLocaleDateString('en-US', LONG_DATE_FORMAT);
}

export function formatLongDateRange(start?: string | null, end?: string | null, empty = '—'): string {
    if (!start && !end) {
        return empty;
    }

    const startLabel = formatLongDate(start, empty);
    const endLabel = formatLongDate(end, empty);

    if (startLabel === endLabel) {
        return startLabel;
    }

    return `${startLabel} → ${endLabel}`;
}
