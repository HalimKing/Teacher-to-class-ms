<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    /**
     * Display a listing of the resource.
     */
     public function index(Request $request)
    {
        // Authorization - check if user can view users
        // if (!Gate::allows('view-users')) {
        //     abort(403);
        // }

        // Start query
        $query = User::query()
        ->with('roles')
            ->latest()
            ->select(['id', 'name', 'email', 'staff_id', 'created_at']);

        

        // Apply search filter
        if ($request->has('search') && $request->search != '') {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('staff_id', 'like', "%{$search}%");
            });
        }

        // Paginate results
        $users = $query->paginate(15)
            ->withQueryString();
            
       
        // dd($users);
        return Inertia::render('admin/user/index', [
            'users' => $users,
            'filters' => $request->only(['search']),
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
        return Inertia::render('admin/user/create', [
            'roles' => Role::all('name', 'id'),
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
        // dd($request->all());
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email',
            'staff_id' => 'required|string|max:50|unique:users,staff_id',
            'roles' => 'required|array',
            'roles.*' => 'exists:roles,name',
        ]);

        // default password
        $defaultPassword = 'Password123!';

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'staff_id' => $validated['staff_id'],
            'password' => Hash::make($defaultPassword),
        ]);

       
        $user->syncRoles($request->roles);
        

        return redirect()->route('admin.user-management.users.index')->with('success', 'User created successfully!');
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(User $user)
    {
        //
        // if (!Gate::allows('update-users')) {
        //     abort(403);
        // }
        // dd($user);

        return Inertia::render('admin/user/edit', [
            'user' => $user,
            'userRoles' => $user->roles->pluck('name'),
            'roles' => Role::all('name', 'id'),
        ]);

    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        //
        // dd($request->all());
        $user = User::findOrFail($id);
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,' . $user->id,
            'staff_id' => 'required|string|max:50|unique:users,staff_id,' . $user->id,
            'roles' => 'required|array',
            'roles.*' => 'exists:roles,name',
        ]);

        $user->name = $validated['name'];
        $user->email = $validated['email'];
        $user->staff_id = $validated['staff_id'];
        $user->save();

        $user->syncRoles($request->roles);

        return redirect()->route('admin.user-management.users.index')->with('success', 'User updated successfully!');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(User $user)
    {
        //
        $user->delete();
        return redirect()->route('admin.user-management.users.index')->with('success', 'User deleted successfully!!!');

    }
}
