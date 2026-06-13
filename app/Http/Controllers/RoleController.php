<?php

namespace App\Http\Controllers;

use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    private function groupedPermissions()
    {
        return Permission::query()
            ->orderBy('name')
            ->get()
            ->groupBy(function (Permission $permission) {
                $parts = explode('.', $permission->name);

                if (($parts[0] ?? null) === 'admin' && !empty($parts[1])) {
                    return 'admin.' . $parts[1];
                }

                return $parts[0] ?? 'general';
            });
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        // $this->authorize('viewAny', Role::class);

        // Get search query
        $search = $request->input('search');

        // Query roles with eager loading of permissions
        $roles = Role::query()
            ->with('permissions')
            ->when($search, function ($query, $search) {
                return $query->where('name', 'like', "%{$search}%");
            })
            ->orderBy('name')
            ->paginate(10)
            ->through(function ($role) {
                return [
                    'id' => $role->id,
                    'name' => $role->name,
                    'permissions' => $role->permissions->map(function ($permission) {
                        return [
                            'id' => $permission->id,
                            'name' => $permission->name,
                            'guard_name' => $permission->guard_name,
                        ];
                    }),
                    'created_at' => $role->created_at->toISOString(),
                    'updated_at' => $role->updated_at->toISOString(),
                ];
            });

            // dd($roles);

        return Inertia::render('admin/role/index', [
            'roles' => $roles,
            'filters' => $request->only(['search']),
        ]);
    }


    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
        
        return Inertia::render('admin/role/create', [
            'permissions' => $this->groupedPermissions(),
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
        // dd($request->all());
        $validator = $request->validate([
            'name' => 'required|string|max:255|unique:roles,name',
            'permissions' => 'nullable|array',
            'permissions.*' => 'exists:permissions,name',
        ]);

        // dd($request->all());
        try {
            $role = Role::create(['name' => $request->name]);
            if ($request->has('permissions')) {
                $role->syncPermissions($request->permissions);
            }

            app(ActivityLogService::class)->logUserManagement(
                'role_created',
                "Created role {$role->name}",
                ['role_id' => $role->id, 'permissions' => $request->permissions ?? []]
            );

            return redirect()->route('admin.user-management.roles.index')
            ->with('success', 'Successful created!');
        }catch(\Exception $e){
            return redirect()->route('admin.user-management.roles.index')
            ->with('error', $e->getMessage());
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(Role $role)
    {
        // $this->authorize('view', $role);

        $role->load(['permissions', 'users']);

        return Inertia::render('admin/role/show', [
            'role' => [
                'id' => $role->id,
                'name' => $role->name,
                'permissions' => $role->permissions->map(function ($permission) {
                    return [
                        'id' => $permission->id,
                        'name' => $permission->name,
                        'guard_name' => $permission->guard_name,
                    ];
                }),
                'users_count' => $role->users()->count(),
                'created_at' => $role->created_at->toISOString(),
                'updated_at' => $role->updated_at->toISOString(),
            ],
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Role $role)
    {
        // $this->authorize('update', $role);

        $role->load('permissions');

        return Inertia::render('admin/role/edit', [
            'role' => [
                'id' => $role->id,
                'name' => $role->name,
                'permissions' => $role->permissions->pluck('name')->toArray(),
            ],
            'permissions' => $this->groupedPermissions(),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Role $role)
    {
        //
        $validator = $request->validate([
            'name' => 'required|string|max:255|unique:roles,name,'.  $role->id,
            'permissions' => 'nullable|array',
            'permissions.*' => 'exists:permissions,name',
        ]);

        // dd($request->all());
         try {
            $role->name = $validator['name'];
            if ($request->has('permissions')) {
                $role->syncPermissions($request->permissions);
            }

            app(ActivityLogService::class)->logUserManagement(
                'role_updated',
                "Updated role {$role->name}",
                ['role_id' => $role->id, 'permissions' => $request->permissions ?? []]
            );

            return redirect()->route('admin.user-management.roles.index')
            ->with('success', 'Successful updated!');
        }catch(\Exception $e){
            return redirect()->route('admin.user-management.roles.index')
            ->with('error', $e->getMessage());
        }
        

    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Role $role)
    {
        //
        // $this->authorize('delete', $role);

        try {
            $roleName = $role->name;
            $roleId = $role->id;
            $role->delete();

            app(ActivityLogService::class)->logUserManagement(
                'role_deleted',
                "Deleted role {$roleName}",
                ['role_id' => $roleId]
            );

            return redirect()->route('admin.user-management.roles.index')
            ->with('success', 'Successful deleted!');
        }catch(\Exception $e){
            return redirect()->route('admin.user-management.roles.index')
            ->with('error', $e->getMessage());
        }

    }
}
