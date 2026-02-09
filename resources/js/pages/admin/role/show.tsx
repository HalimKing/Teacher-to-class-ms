import React from 'react';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { 
  Shield, 
  Edit, 
  ArrowLeft, 
  Users,
  Calendar,
  Clock,
  Key,
  CheckCircle,
  XCircle
} from 'lucide-react';
import Button from '@mui/material/Button';

interface Permission {
  id: number;
  name: string;
  guard_name: string;
}

interface Role {
  id: number;
  name: string;
  permissions: Permission[];
  created_at: string;
  updated_at: string;
  users_count: number;
}

interface ShowRolePageProps {
  role: Role;
}

const ShowRolePage = ({ role }: ShowRolePageProps) => {
  // Format date with time
  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return `${Math.floor(diffInDays / 365)} years ago`;
  };

  // Group permissions by resource
  const groupPermissions = () => {
    const groups: { [key: string]: Permission[] } = {};
    
    role.permissions.forEach(permission => {
      const groupName = permission.name.split('.')[0] || 'general';
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(permission);
    });
    
    return groups;
  };

  const permissionGroups = groupPermissions();

  // Get color for permission group
  const getGroupColor = (groupName: string) => {
    const colorMap: { [key: string]: string } = {
      'users': 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20',
      'roles': 'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20',
      'permissions': 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20',
      'settings': 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20',
      'dashboard': 'border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/20',
      'admin': 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20',
    };
    
    return colorMap[groupName] || 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800';
  };

  // Get icon for permission group
  const getGroupIcon = (groupName: string) => {
    const iconMap: { [key: string]: string } = {
      'users': '👥',
      'roles': '🛡️',
      'permissions': '🔑',
      'settings': '⚙️',
      'dashboard': '📊',
      'admin': '👑',
    };
    
    return iconMap[groupName] || '📝';
  };

  // Format permission name
  const formatPermissionName = (permissionName: string) => {
    return permissionName
      .split('.')
      .slice(1)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') || 'View';
  };

  const breadcrumbs = [
    {
      title: 'Dashboard',
      href: '/admin/dashboard',
    },
    {
      title: 'Roles',
      href: '/admin/user-management/roles',
    },
    {
      title: role.name,
      href: `/admin/user-management/roles/${role.id}`,
    }
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`Role: ${role.name}`} />
      
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header Section */}
          <div className="mb-6">
            <Link
              href="/admin/user-management/roles"
              className="inline-flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300 mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Roles
            </Link>
            
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className={`w-16 h-16 bg-gradient-to-r ${
                  role.name.toLowerCase().includes('admin') ? 'from-red-500 to-pink-600' :
                  role.name.toLowerCase().includes('user') ? 'from-blue-500 to-indigo-600' :
                  role.name.toLowerCase().includes('manager') ? 'from-green-500 to-teal-600' :
                  'from-purple-500 to-indigo-600'
                } rounded-2xl flex items-center justify-center`}>
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{role.name}</h1>
                  <p className="text-slate-600 dark:text-slate-400">Role ID: {role.id}</p>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <Link
                  href={`/admin/user-management/roles/${role.id}/edit`}
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-medium rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Role
                </Link>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Permissions</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                    {role.permissions.length}
                  </p>
                  <div className="flex items-center mt-2">
                    <Key className="w-4 h-4 text-green-500 mr-2" />
                    <span className="text-sm text-green-600 dark:text-green-400">
                      {role.permissions.length > 0 ? 'Active' : 'No permissions'}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                  <Key className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Assigned Users</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                    {role.users_count}
                  </p>
                  <div className="flex items-center mt-2">
                    <Users className="w-4 h-4 text-blue-500 mr-2" />
                    <span className="text-sm text-blue-600 dark:text-blue-400">
                      User{role.users_count !== 1 ? 's' : ''} assigned
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                  <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Last Updated</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mt-2">
                    {formatRelativeTime(role.updated_at)}
                  </p>
                  <div className="flex items-center mt-2">
                    <Clock className="w-4 h-4 text-purple-500 mr-2" />
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {formatDateTime(role.updated_at)}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-xl">
                  <Clock className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Permissions Section */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 mb-8">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Assigned Permissions</h2>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                {role.permissions.length > 0 
                  ? `This role has ${role.permissions.length} permission${role.permissions.length !== 1 ? 's' : ''} across ${Object.keys(permissionGroups).length} categories`
                  : 'This role has no permissions assigned'
                }
              </p>
            </div>
            
            <div className="p-6">
              {Object.keys(permissionGroups).length > 0 ? (
                <div className="space-y-6">
                  {Object.entries(permissionGroups).map(([groupName, permissions]) => (
                    <div 
                      key={groupName} 
                      className={`border rounded-2xl p-6 ${getGroupColor(groupName)}`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{getGroupIcon(groupName)}</span>
                          <div>
                            <h3 className="font-bold text-slate-900 dark:text-white capitalize">
                              {groupName.replace('-', ' ').replace('_', ' ')}
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {permissions.length} permission{permissions.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <span className="text-sm font-medium text-green-600 dark:text-green-400">
                            Full Access
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {permissions.map(permission => (
                          <div 
                            key={permission.id} 
                            className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-4 flex items-center justify-between hover:shadow-md transition-shadow"
                          >
                            <div>
                              <div className="font-medium text-slate-900 dark:text-white">
                                {formatPermissionName(permission.name)}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1 truncate">
                                {permission.name}
                              </div>
                            </div>
                            <div className="flex items-center">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <XCircle className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
                    No Permissions Assigned
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                    This role doesn't have any permissions. Users with this role won't be able to access any features.
                  </p>
                  <Link
                    href={`/admin/user-management/roles/${role.id}/edit`}
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-medium rounded-xl transition-all duration-200"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Add Permissions
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Metadata Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Role Information</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-slate-600 dark:text-slate-400">Role ID</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-white">{role.id}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-slate-600 dark:text-slate-400">Role Name</span>
                  <span className="font-medium text-slate-900 dark:text-white">{role.name}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-slate-600 dark:text-slate-400">Total Users</span>
                  <span className="font-medium text-slate-900 dark:text-white">{role.users_count}</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Timeline</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-900 dark:text-white">Role Created</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {formatDateTime(role.created_at)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      {formatRelativeTime(role.created_at)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-900 dark:text-white">Last Updated</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {formatDateTime(role.updated_at)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      {formatRelativeTime(role.updated_at)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ShowRolePage;