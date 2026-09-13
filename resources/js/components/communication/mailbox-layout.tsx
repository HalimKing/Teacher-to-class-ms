import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { FileText, Inbox, Mail, PenSquare, Send } from 'lucide-react';
import { type ReactNode } from 'react';
import {
    type CommunicationCapabilities,
    type CommunicationFolder,
    type CommunicationFolderCounts,
    type MailboxPrefix,
} from './types';

const FOLDERS: Array<{
    key: CommunicationFolder;
    title: string;
    description: string;
    icon: typeof Inbox;
}> = [
    { key: 'inbox', title: 'Inbox', description: 'Conversations sent to you', icon: Inbox },
    { key: 'sent', title: 'Sent', description: 'Conversations you have written', icon: Send },
    { key: 'drafts', title: 'Drafts', description: 'Messages waiting to be sent', icon: FileText },
    { key: 'all', title: 'All Mail', description: 'Every conversation you can access', icon: Mail },
];

export function mailboxHref(prefix: MailboxPrefix, folder: CommunicationFolder): string {
    return route(`${prefix}.communication.${folder === 'all' ? 'all' : folder}`);
}

export function folderMeta(folder: CommunicationFolder) {
    return FOLDERS.find((item) => item.key === folder) ?? FOLDERS[0];
}

export function CommunicationMailboxLayout({
    prefix,
    folder,
    counts,
    capabilities,
    title,
    description,
    children,
}: {
    prefix: MailboxPrefix;
    folder: CommunicationFolder;
    counts: CommunicationFolderCounts;
    capabilities: CommunicationCapabilities;
    title?: string;
    description?: string;
    children: ReactNode;
}) {
    const meta = folderMeta(folder);
    const composeHref = route(`${prefix}.communication.compose`);

    return (
        <div className="min-w-0 space-y-5 p-3 sm:p-4 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">Communication</p>
                    <h1 className="mt-1 text-xl font-semibold tracking-tight break-words text-sidebar-foreground sm:text-2xl">{title ?? meta.title}</h1>
                    <p className="mt-1 text-sm text-sidebar-foreground/65">{description ?? meta.description}</p>
                </div>
                {capabilities.can_compose && (
                    <Link
                        href={composeHref}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 sm:w-auto"
                    >
                        <PenSquare className="size-4" />
                        New message
                    </Link>
                )}
            </div>

            <div className="grid min-w-0 gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
                <aside className="rounded-2xl border border-sidebar-border/70 bg-card p-2 dark:bg-card">
                    <nav className="grid grid-cols-2 gap-1 sm:flex sm:overflow-x-auto lg:flex-col">
                        {FOLDERS.map((item) => {
                            const href = mailboxHref(prefix, item.key);
                            const active = folder === item.key;
                            const count = item.key === 'inbox' || item.key === 'drafts' ? counts[item.key] : 0;

                            return (
                                <Link
                                    key={item.key}
                                    href={href}
                                    className={cn(
                                        'inline-flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-sm transition',
                                        active
                                            ? 'bg-primary/10 font-semibold text-primary'
                                            : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                                    )}
                                >
                                    <item.icon className="size-4 shrink-0" />
                                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                                    {count > 0 && (
                                        <span
                                            className={cn(
                                                'shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                                                active ? 'bg-primary text-primary-foreground' : 'bg-sidebar-accent text-sidebar-foreground/80',
                                            )}
                                        >
                                            {count > 99 ? '99+' : count}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>
                </aside>
                <div className="min-w-0">{children}</div>
            </div>
        </div>
    );
}
