import { Breadcrumbs } from '@/components/breadcrumbs';
import { Icon } from '@/components/icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem, type NavItem, type SharedData } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import { LayoutGrid, Menu, Search, ChevronDown, ChevronRight, Users, Book, Settings, LogOut, BookOpen, UserCheck, ClipboardList, BarChart, Folder } from 'lucide-react';
import { useState, useMemo } from 'react';
import AppLogo from './app-logo';
import AppLogoIcon from './app-logo-icon';
import { can } from '@/lib/can';
import { log } from 'console';
import { useMobileNavigation } from '@/hooks/use-mobile-navigation';

const teacherNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: '/teacher/dashboard',
        icon: LayoutGrid,
        permission: 'admin.teachers.view',
    },
    {
        title: 'Take Attendance',
        href: '/teacher/attendance',
        icon: UserCheck,
        permission: 'admin.teachers.view',
    },
    {
        title: 'My Courses',
        href: '/teacher/my-courses',
        icon: BookOpen,
        permission: 'teacher.my-courses.view',
    },
    {
        title: 'Records',
        href: '/teacher/records',
        icon: Folder,
        permission: 'teacher.records.view',
    },
    {
        title: 'Reports',
        href: '/teacher/reports',
        icon: BarChart,
        permission: 'teacher.reports.view',
    },

];


const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: '/admin/dashboard',
        icon: LayoutGrid,
        permission: 'admin.dashboard.view',
    },
    {
        title: 'Teachers',
        href: '/admin/teachers',
        icon: LayoutGrid,
        permission: 'admin.teachers.view',
        subItems: [
            {
                title: 'All Teachers',
                href: '/admin/teachers',
                permission: 'admin.teachers.view',
            },
            {
                title: 'Add Teacher',
                href: '/admin/teachers/create',
                permission: 'admin.teachers.create',
            },
            {
                title: 'Password Management',
                href: '/admin/teachers/password-management',
                permission: 'admin.teachers.password-management',
            }
           
        ]
    },
    {
        title: 'School Management',
        href: '/admin/school-management',
        icon: LayoutGrid,
        permission: 'admin.school-management.faculties.view',
        subItems: [
            {
                title: 'Faculty List',
                href: '/admin/school-management/faculties',
                permission: 'admin.school-management.faculties.view',
            },
            {
                title: 'Add Faculty',
                href: '/admin/school-management/faculties/create',
                permission: 'admin.school-management.faculties.create',
            },
            {
                title: 'Department List',
                href: '/admin/school-management/departments',
                permission: 'admin.school-management.departments.view',
            },
            {
                title: 'Add Department',
                href: '/admin/school-management/departments/create',
                permission: 'admin.school-management.departments.create',
            },
            {
                title: 'Class List',
                href: '/admin/school-management/class-rooms',
                permission: 'admin.school-management.class-rooms.view',
            },
            {
                title: 'Add Class',
                href: '/admin/school-management/class-rooms/create',
                permission: 'admin.school-management.class-rooms.create',
            },
            {
                title: 'Academic Year List',
                href: '/admin/school-management/academic-years',
                permission: 'admin.school-management.academic-years.view',
            },
            {
                title: 'Add Academic Year',
                href: '/admin/school-management/academic-years/create',
                permission: 'admin.school-management.academic-years.create',
            },
            {
                title: 'Program List',
                href: '/admin/school-management/programs',
                permission: 'admin.school-management.programs.view',
            },
            {
                title: 'Add Program',
                href: '/admin/school-management/programs/create',
                permission: 'admin.school-management.programs.create',
            },
            {
                title: 'Course List',
                href: '/admin/school-management/courses',
                permission: 'admin.school-management.courses.view',
            },
            {
                title: 'Add Course',
                href: '/admin/school-management/courses/create',
                permission: 'admin.school-management.courses.create',
            },
            {
                title: 'Academic Period List',
                href: '/admin/school-management/academic-periods',
                permission: 'admin.school-management.academic-periods.view',
            },
            {
                title: 'Add Academic Period',
                href: '/admin/school-management/academic-periods/create',
                permission: 'admin.school-management.academic-periods.create',
            }
        ]
    },
    {
        title: 'Academics',
        href: '/admin/academics',
        icon: Book,
        permission: 'admin.academics.view',
        subItems: [
            {
                title: 'Time Tables',
                href: '/admin/academics/time-tables',
                permission: 'admin.academics.time-tables.view',
            },
            {
                title: 'Add Time Table',
                href: '/admin/academics/time-tables/create',
                permission: 'admin.academics.time-tables.create',
            },
            {
                title: 'Generate Time Table',
                href: '/admin/academics/time-tables/generate',
                permission: 'admin.academics.time-tables.generate',
            }
        ]
    },
    {
        title: 'Users',
        href: '/admin/user-management',
        icon: Users,
        permission: 'user-management.view',
        subItems: [
            {
                title: 'All Users',
                href: '/admin/user-management/users',
                permission: 'admin.user-management.users.view',
            },
            {
                title: 'Add User',
                href: '/admin/user-management/users/create',
                permission: 'admin.user-management.users.create',
            },
            {
                title: 'User Roles',
                href: '/admin/user-management/roles',
                permission: 'admin.user-management.roles.view',
            }
        ]
    }
];

const activeItemStyles = 'text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100';

interface AppHeaderProps {
    breadcrumbs?: BreadcrumbItem[];
}

export function AppHeader({ breadcrumbs = [] }: AppHeaderProps) {
    const page = usePage<SharedData>();
    const { auth } = page.props;
    const getInitials = useInitials();
    const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
    const [navItems, setNavItems] = useState<NavItem[]>(auth.user && auth.guard === 'teacher' ? teacherNavItems : mainNavItems);

    const isTeacher = auth.user && auth.guard === 'teacher';

    console.log('User Info:', isTeacher ? 'Teacher' : 'Admin', auth.user);
    

    // Helper function to check permissions
    

    // Filter navigation items based on permissions
    const filteredNavItems = useMemo(() => {
        if (isTeacher) {
            return teacherNavItems;
        }
        return mainNavItems.filter(item => {
            // Check if user has permission for the main item
            const hasMainPermission = can(item.permission as string);
            
            // If item has subItems, filter those too
            if (item.subItems && item.subItems.length > 0) {
                
                const filteredSubItems = item.subItems.filter(subItem => 
                    can(subItem.permission as string)
                );
                
                // Only show main item if it has permission OR if it has any visible sub-items
                return hasMainPermission || filteredSubItems.length > 0;
            }
            
            return hasMainPermission;
        }).map(item => {
            if (item.subItems) {
                return {
                    ...item,
                    subItems: item.subItems.filter(subItem => can(subItem.permission as any))
                };
            }
            return item;
        }).filter(item => {
            // Remove items that have subItems but all subItems were filtered out
            if (item.subItems && item.subItems.length === 0) {
                return false;
            }
            return true;
        });
    }, [auth.user]);


    console.log('Filtered Nav Items:', filteredNavItems);

    const toggleMobileSubmenu = (itemTitle: string) => {
        setExpandedItems((prev) => ({
            ...prev,
            [itemTitle]: !prev[itemTitle],
        }));
    };

    const cleanup = useMobileNavigation();

       const handleLogout = () => {
            cleanup();
            router.flushAll();
        };

    return (
        <>
            <div className="border-b border-sidebar-border/80 sticky top-0 z-50 bg-sidebar">
                <div className="mx-auto flex h-16 items-center justify-between gap-2 px-3 sm:px-4 md:max-w-7xl">
                    {/* Mobile Menu */}
                    <div className="lg:hidden">
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="mr-2 h-[34px] w-[34px]">
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-72 flex h-full flex-col items-stretch justify-between bg-sidebar overflow-y-auto">
                                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                                <SheetHeader className="flex justify-start text-left">
                                    <AppLogoIcon className="h-6 w-6 fill-current text-black dark:text-white" />
                                </SheetHeader>
                                <div className="flex h-full flex-1 flex-col space-y-4 p-4">
                                    <div className="flex h-full flex-col justify-between text-sm">
                                        <div className="flex flex-col space-y-3">
                                            {filteredNavItems.map((item) => (
                                                <div key={item.title}>
                                                    {item.subItems && item.subItems.length > 0 ? (
                                                        <>
                                                            <button
                                                                onClick={() => toggleMobileSubmenu(item.title)}
                                                                className={cn(
                                                                    'w-full flex items-center space-x-3 rounded-md px-3 py-2 font-medium transition-colors text-left',
                                                                    'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                                                                    expandedItems[item.title] && 'bg-neutral-100 dark:bg-neutral-800'
                                                                )}
                                                            >
                                                                {item.icon && <Icon iconNode={item.icon} className="h-5 w-5 flex-shrink-0" />}
                                                                <span className="text-base flex-1">{item.title}</span>
                                                                <ChevronRight className={cn(
                                                                    'h-4 w-4 transition-transform',
                                                                    expandedItems[item.title] && 'rotate-90'
                                                                )} />
                                                            </button>
                                                            {expandedItems[item.title] && (
                                                                <div className="ml-6 mt-2 flex flex-col space-y-2">
                                                                    {item.subItems.map((subItem) => (
                                                                        <Link
                                                                            key={subItem.title}
                                                                            href={subItem.href}
                                                                            className={cn(
                                                                                'text-sm rounded px-2 py-1.5 transition-colors',
                                                                                'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-neutral-100 dark:hover:text-slate-200 dark:hover:bg-neutral-800',
                                                                                page.url === subItem.href && 'bg-neutral-100 text-slate-900 dark:bg-neutral-800 dark:text-slate-100'
                                                                            )}
                                                                        >
                                                                            {subItem.title}
                                                                        </Link>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <Link 
                                                            href={item.href} 
                                                            className={cn(
                                                                'flex items-center space-x-3 rounded-md px-3 py-2 font-medium transition-colors',
                                                                'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                                                                page.url === item.href && 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50'
                                                            )}
                                                        >
                                                            {item.icon && <Icon iconNode={item.icon} className="h-5 w-5 flex-shrink-0" />}
                                                            <span className="text-base">{item.title}</span>
                                                        </Link>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>

                    <Link href="/dashboard" prefetch className="flex-shrink-0 flex items-center space-x-2">
                        <div className="hidden sm:block">
                            <AppLogo />
                        </div>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="ml-6 hidden h-full items-center space-x-6 lg:flex">
                        <div className="flex h-full items-stretch space-x-2"> 
                            {filteredNavItems.map((item, index) => (
                                <div key={index} className="relative flex h-full items-center">
                                    {item.subItems && item.subItems.length > 0 ? (
                                        <DropdownMenu key={item.title}>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    className={cn(
                                                        'h-9 cursor-pointer px-3 flex items-center justify-center font-medium transition-colors hover:bg-neutral-100 hover:text-neutral-900 data-[state=open]:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-50 dark:data-[state=open]:bg-neutral-800 dark:text-neutral-300 dark:hover:text-neutral-50',
                                                        (page.url === item.href || page.url.startsWith(item.href)) && activeItemStyles
                                                    )}
                                                >
                                                    {item.icon && <Icon iconNode={item.icon} className="mr-2 h-4 w-4" />}
                                                    {item.title}
                                                    <ChevronDown className="ml-2 h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent 
                                                className={cn(
                                                    'align-start side-bottom sideOffset-8', 
                                                    item.title === 'School Management' ? 'w-[500px]' : 'w-56 max-h-[400px] overflow-y-auto'
                                                )} 
                                                align="start" 
                                                side="bottom" 
                                                sideOffset={8}
                                            >
                                                {item.title === 'School Management' ? (
                                                    <div className="grid grid-cols-2 gap-2 p-2 max-h-[500px] overflow-y-auto">
                                                        {item.subItems.map((subItem, subIndex) => (
                                                            <Link
                                                                key={subIndex}
                                                                href={subItem.href}
                                                                className={cn(
                                                                    'text-sm cursor-pointer px-3 py-2 rounded transition-colors text-left hover:bg-neutral-100 dark:hover:bg-neutral-700',
                                                                    page.url === subItem.href && 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50'
                                                                )}
                                                            >
                                                                {subItem.title}
                                                            </Link>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <>
                                                        {item.subItems.map((subItem, subIndex) => (
                                                            <DropdownMenuItem key={subIndex} asChild>
                                                                <Link
                                                                    href={subItem.href}
                                                                    className={cn(
                                                                        'text-sm cursor-pointer px-2 py-1.5 rounded transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700',
                                                                        page.url === subItem.href && 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50'
                                                                    )}
                                                                >
                                                                    {subItem.title}
                                                                </Link>
                                                            </DropdownMenuItem>
                                                        ))}
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    ) : (
                                        <Link
                                            href={item.href}
                                            className={cn(
                                                'inline-flex h-9 items-center justify-center rounded-md px-3 py-1 text-sm font-medium transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:text-neutral-300 dark:hover:text-neutral-50',
                                                page.url === item.href && activeItemStyles,
                                                'cursor-pointer',
                                            )}
                                        >
                                            {item.icon && <Icon iconNode={item.icon} className="mr-2 h-4 w-4" />}
                                            {item.title}
                                        </Link>
                                    )}
                                    {/* Active indicator bar */}
                                    {page.url === item.href && !item.subItems && (
                                        <div className="absolute bottom-0 left-0 h-0.5 w-full translate-y-px bg-black dark:bg-white"></div>
                                    )}
                                    {(page.url === item.href || page.url.startsWith(item.href)) && item.subItems && item.subItems.length > 0 && (
                                        <div className="absolute bottom-0 left-0 h-0.5 w-full translate-y-px bg-black dark:bg-white"></div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="ml-auto flex items-center space-x-1 sm:space-x-2">
    <div className="relative hidden md:flex items-center space-x-1">
        <Button variant="ghost" size="icon" className="group h-9 w-9 cursor-pointer">
            <Search className="!size-5 opacity-80 group-hover:opacity-100" />
        </Button>
    </div>
    
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 w-9 sm:h-10 sm:w-10 rounded-full p-0.5 sm:p-1">
                <Avatar className="h-8 w-8 sm:h-8 sm:w-8 overflow-hidden rounded-full">
                    <AvatarImage src={''} alt='' />
                    <AvatarFallback className="rounded-lg bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                        {getInitials(isTeacher ? auth.user.first_name + ' ' + auth.user.last_name : auth.user.name)}
                    </AvatarFallback>
                </Avatar>
            </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent className="w-56" align="end" forceMount>
            {/* User Info Header */}
            <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{auth.user.first_name + ' ' + auth.user.last_name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{auth.user.email}</p>
                </div>
            </DropdownMenuLabel>
            
            <DropdownMenuSeparator />
            
            {/* Menu Items */}
            <DropdownMenuGroup>
                <DropdownMenuItem className="cursor-pointer">
                    <Link href={route('profile.edit')} className="flex items-center w-full" prefetch onClick={cleanup}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuGroup>
            
            <DropdownMenuSeparator />
            
            {/* Logout Action */}
             <DropdownMenuItem asChild className="cursor-pointer text-red-600 focus:text-red-600 dark:text-red-400">
                <Link className="block w-full" method="post" href={route('logout')} as="button" onClick={handleLogout}>
                    <LogOut className="mr-2" />
                    Log out
                </Link>
            </DropdownMenuItem>
            
        </DropdownMenuContent>
    </DropdownMenu>
</div>
                </div>
            </div>
            {breadcrumbs.length > 1 && (
                <div className="flex w-full border-b border-sidebar-border/70">
                    <div className="mx-auto flex h-12 w-full items-center justify-start px-4 text-neutral-500 md:max-w-7xl">
                        <Breadcrumbs breadcrumbs={breadcrumbs} />
                    </div>
                </div>
            )}
        </>
    );
}