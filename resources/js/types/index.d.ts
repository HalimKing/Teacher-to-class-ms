import { LucideIcon } from 'lucide-react';
import type { Config } from 'ziggy-js';

export interface Auth {
    user: User;
    guard: string;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    href: string;
    icon?: LucideIcon | null;
    isActive?: boolean;
    subItems?: NavItem[];
    permission?: string;
}

export interface SharedData {
    name: string;
   
    quote: { message: string; author: string };
    auth: Auth;
    ziggy: Config & { location: string };
    sidebarOpen: boolean;
    [key: string]: unknown;
}

export interface User {
    id: number;
    name: string;
    first_name?: string;
    last_name?: string;
    title?: string;
    other_name?: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown; // This allows for additional properties...
}


interface FlashProps {
    success?: string;
    error?: string;
}

export interface PagePropsWithFlash {
    flash?: FlashProps; // Make flash optional
    // Include other expected props
}

export type AttendanceStatus = 'COMPLETED' | 'PENDING' | 'UPCOMING';

export interface SchoolClass {
  id: string;
  shortName: string;
  fullName: string;
  subject: string;
  startTime: string;
  endTime: string;
  status: AttendanceStatus;
  colorClass: string;
}