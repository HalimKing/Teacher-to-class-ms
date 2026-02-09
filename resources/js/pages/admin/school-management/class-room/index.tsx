import React, { useState, useEffect } from 'react';
import { 
  Search,
  Plus,
  Edit,
  Trash2,
  MapPin,
  Target,
  CheckCircle,
  XCircle
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { PagePropsWithFlash } from '@/types';
import { ToastContainer, toast, Bounce } from 'react-toastify';
import { can } from '@/lib/can';

// Update interface for paginated data
interface ClassRoom {
  id: number;
  name: string;
  capacity: number;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number | null;
  is_active: boolean;
}

interface PaginatedClassRooms {
  data: ClassRoom[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
  links: Array<{
    url: string | null;
    label: string;
    active: boolean;
  }>;
}

interface TeachersIndexPageProps {
  classRoomData: PaginatedClassRooms;
  search?: string; // Add search prop from backend
}

const ClassRoomIndexPage = ({ classRoomData, search }: TeachersIndexPageProps) => {
  const [searchTerm, setSearchTerm] = useState(search || '');
  const { flash } = usePage().props as PagePropsWithFlash;
  
  // Show toast notifications based on flash messages
  useEffect(() => {
    if (flash?.success) {
      toast.success(flash.success || 'Class room created successfully!', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
        transition: Bounce,
      });
    }
    if (flash?.error) {
      toast.error(flash.error || 'An error occurred!', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
        transition: Bounce,
      });
    }
  },[flash]);

  // Handle search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      router.get(route('admin.school-management.class-rooms.index'), 
        { search: searchTerm || '' }, // Send empty string if search is cleared
        {
          preserveState: true,
          replace: true,
          preserveScroll: true,
        }
      );
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  
  const class_rooms: PaginatedClassRooms = classRoomData;

  const breadcrumbs = [
    {
      title: 'Dashboard',
      href: '/admin/dashboard',
    },
    {
      title: 'Class Rooms',
      href: '/admin/school-management/class-rooms',
    }
  ];

  // Function to handle pagination with Inertia
  const handlePageChange = (url: string | null) => {
    if (url) {
      router.get(url, {}, {
        preserveState: true,
        replace: true,
        preserveScroll: true,
      });
    }
  };

  // Function to clear search
  const clearSearch = () => {
    setSearchTerm('');
  };

  // Format location coordinates for display
 const formatLocation = (classRoom: ClassRoom) => {
  if (!classRoom.latitude || !classRoom.longitude) {
    return 'Not set';
  }
  
  // Ensure both values are numbers before calling toFixed
  const lat = Number(classRoom.latitude);
  const lng = Number(classRoom.longitude);
  
  // Check if conversion was successful
  if (isNaN(lat) || isNaN(lng)) {
    return 'Invalid coordinates';
  }
  
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
};

  // Format radius for display
  const formatRadius = (classRoom: ClassRoom) => {
    if (!classRoom.radius_meters) {
      return 'Not set';
    }
    return `${classRoom.radius_meters}m`;
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Class Rooms" />
      <div className="min-h-screen bg-slate-50 flex">
        {/* -------------------- MAIN CONTENT AREA -------------------- */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Page Content */}
          <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Class Rooms</h1>
                <p className="text-slate-600">Manage classroom information, locations, and attendance boundaries</p>
              </div>
              {can('admin.school-management.class-rooms.create') && (
              <Link
                href={route('admin.school-management.class-rooms.create')} 
                className="mt-4 sm:mt-0 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Class Room
              </Link>
              )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl p-6 shadow-md border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Total Class Rooms</p>
                    <p className="text-3xl font-bold text-slate-900">{class_rooms.total}</p>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-lg">
                    <Target className="w-6 h-6 text-indigo-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Active Class Rooms</p>
                    <p className="text-3xl font-bold text-slate-900">
                      {class_rooms.data.filter(cr => cr.is_active).length}
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">With Location Data</p>
                    <p className="text-3xl font-bold text-slate-900">
                      {class_rooms.data.filter(cr => cr.latitude && cr.longitude).length}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <MapPin className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Avg. Capacity</p>
                    <p className="text-3xl font-bold text-slate-900">
                      {class_rooms.data.length > 0 
                        ? Math.round(class_rooms.data.reduce((acc, cr) => acc + cr.capacity, 0) / class_rooms.data.length)
                        : 0
                      }
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <span className="text-2xl font-bold text-purple-600">👥</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Class Rooms Table */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
              <div className="p-6 border-b border-slate-200">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                  <h3 className="text-xl font-bold text-slate-900">Class Room List</h3>
                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Search class rooms..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm w-full sm:w-64 transition-shadow"
                      />
                      {searchTerm && (
                        <button
                          onClick={clearSearch}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">#</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Capacity</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Location</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Radius</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {class_rooms.data.length > 0 ? (
                      class_rooms.data.map((class_room, index) => (
                        <tr key={class_room.id} className="hover:bg-indigo-50/20 transition-colors">
                          <td className='text-right px-4 py-4'>
                            {index + 1 + (class_rooms.current_page - 1) * class_rooms.per_page}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-4">
                              <div className="text-sm font-semibold text-slate-900">
                                <p style={{ textTransform: 'capitalize' }}>{class_room.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700">
                              {class_room.capacity} seats
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-2">
                              <MapPin className="w-4 h-4 text-slate-400" />
                              <span className="text-sm text-slate-700 font-mono">
                                {formatLocation(class_room)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-slate-700">
                              {formatRadius(class_room)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                              class_room.is_active 
                                ? 'bg-green-50 text-green-700' 
                                : 'bg-red-50 text-red-700'
                            }`}>
                              {class_room.is_active ? (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Active
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Inactive
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-1">
                              {can('admin.school-management.class-rooms.edit') && (
                              <Link 
                                title="Edit Class Room" 
                                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                href={route('admin.school-management.class-rooms.edit', class_room.id)}
                              >
                                <Edit className="w-5 h-5" />
                              </Link>
                              )}

                              {can('admin.school-management.class-rooms.delete') && (
                              <Link 
                                title="Delete Class Room" 
                                method='delete'
                                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                onClick={() => confirm('Are you sure you want to permanently delete this class room?')}
                                href={route('admin.school-management.class-rooms.destroy', class_room.id)}
                              >
                                <Trash2 className="w-5 h-5" />
                              </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                          No Class Rooms Found. {searchTerm && 'Try adjusting your search terms.'}
                          <div className="mt-4">
                            <Link 
                              href={route('admin.school-management.class-rooms.create')}
                              className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Create your first class room
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between flex-wrap gap-4">
                <div className="text-sm text-slate-600">
                  Showing <span className="font-semibold text-slate-800">{class_rooms.from}</span> to <span className="font-semibold text-slate-800">{class_rooms.to}</span> of <span className="font-semibold text-slate-800">{class_rooms.total}</span> Class Rooms
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => handlePageChange(class_rooms.links[0].url)}
                    disabled={class_rooms.current_page === 1}
                    className={`px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium ${
                      class_rooms.current_page === 1 
                        ? 'text-slate-400 bg-slate-100 cursor-not-allowed' 
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Previous
                  </button>
                  
                  {/* Page Numbers */}
                  <div className="hidden sm:flex space-x-1">
                    {class_rooms.links.slice(1, -1).map((link, index) => (
                      <button
                        key={index}
                        onClick={() => handlePageChange(link.url)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                          link.active
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-700 hover:bg-slate-100 border border-slate-300'
                        }`}
                        dangerouslySetInnerHTML={{ __html: link.label }}
                      />
                    ))}
                  </div>
                  
                  <button 
                    onClick={() => handlePageChange(class_rooms.links[class_rooms.links.length - 1].url)}
                    disabled={class_rooms.current_page === class_rooms.last_page}
                    className={`px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium ${
                      class_rooms.current_page === class_rooms.last_page 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:bg-indigo-700'
                    }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </AppLayout>
  );
};

export default ClassRoomIndexPage;