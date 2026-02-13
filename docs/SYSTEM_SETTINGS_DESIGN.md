# System Settings Module — Design & Analysis

## 1. Project analysis summary

### 1.1 Stack and structure
- **Backend**: Laravel (PHP), Inertia.js for server-driven React.
- **Frontend**: React (TypeScript), Vite, Tailwind, shadcn-style UI (Button, Input, Label, Card, etc.).
- **Auth**: Two guards — `web` (admin/staff via `User` model) and `teacher` (via `Teacher` model). Spatie Laravel Permission for roles/permissions on `User` only.
- **Routes**: `web.php` (admin under `auth:web` + `verified`, teacher under `auth:teacher`); `settings.php` for profile/password/appearance (both guards).

### 1.2 Data models relevant to settings
- **TeacherAttendance**: `teacher_id`, `timetable_id`, `course_id`, `classroom_id`, `academic_year_id`, `date`, `check_in_time`, `check_in_latitude/longitude`, `check_in_distance`, `check_in_within_range`, `check_out_*`, `status` (pending|completed|absent|late|early_leave).
- **ClassRoom**: `latitude`, `longitude`, `radius_meters` (per-room GPS radius), `is_active`.
- **TimeTable**: `start_time`, `end_time`, `day`, links to course and class_room. Used to get “today’s classes” and validate check-in/check-out times.
- **AcademicYear / AcademicPeriod**: Used for academic context; no direct settings dependency.

### 1.3 Attendance workflow (current)
- Teacher opens **Take Attendance**; frontend calls `/teacher/attendance/todays-classes` to get classes with `coordinates` and `radius` from **ClassRoom**.
- **Check-in**: POST with `coordinates`, `distance`, `within_range`, `timetable_id`, etc. Backend validates class start time, no duplicate active check-in, then saves attendance (currently allows check-in even if `within_range` is false — no hard enforcement).
- **Check-out**: POST with `attendance_id`, `coordinates`; backend checks class end time then saves check-out. Check-out validation does not currently enforce location.
- Radius and coordinates are **per classroom**; there is no system-wide default radius or “max distance” yet.

### 1.4 Conventions to follow
- Admin routes: `Route::prefix('admin')->name('admin.')->middleware(['auth:web','verified'])` and often `->middleware('permission:...')`.
- Controllers: `App\Http\Controllers\Admin\*` for admin; Inertia `render('admin/...')` for pages.
- Frontend: `AppLayout` + breadcrumbs; forms with `useForm` from Inertia or local state + `router.put/post`; permission-based nav in `app-header.tsx` via `can(permission)`.
- Settings (profile): `SettingsLayout` with sidebar; not used for system settings (admin-only, different audience).

---

## 2. System Settings structure (proposal)

### 2.1 Storage: key-value table `system_settings`
- **Rationale**: Easy to add new keys without migrations; one place for all config; can cache by group; fits “key-value” semantics (e.g. institution name, timezone, booleans).
- **Schema**: `id`, `key` (string, unique), `value` (text), `group` (string, index), `type` (string: string|integer|boolean|json), `description` (nullable), `timestamps`.
- **Groups**: `general`, `attendance`, `map`, `notifications`, `roles` (optional for future). Frontend and validation are grouped (e.g. “General Settings”, “Attendance Settings”).

### 2.2 Default keys (to seed)

| Group        | Key                          | Type    | Description / use |
|-------------|------------------------------|--------|-------------------------------------|
| general     | institution_name            | string | School/institution name              |
| general     | academic_year_id            | integer| Default/current academic year (optional) |
| general     | timezone                    | string | Default timezone (e.g. Africa/Cairo) |
| general     | date_format                 | string | e.g. `Y-m-d`                         |
| general     | time_format                 | string | e.g. `H:i`                           |
| attendance  | gps_radius_meters           | integer| Default allowed GPS radius (fallback if room has none) |
| attendance  | gps_enforcement_enabled     | boolean| Enforce location for check-in/out   |
| attendance  | late_check_in_minutes       | integer| Minutes after class start = late    |
| attendance  | early_leave_minutes         | integer| Minutes before class end = early leave |
| attendance  | auto_mark_absent_after_end | boolean| Auto-mark absent after class end    |
| attendance  | allow_manual_override       | boolean| Allow admin to override attendance manually |
| map         | google_maps_api_key         | string | API key (optional; can stay in .env) |
| map         | default_campus_lat          | decimal| Default campus latitude             |
| map         | default_campus_lng          | decimal| Default campus longitude            |
| map         | max_check_in_distance_meters| integer| Max allowed distance for check-in   |
| map         | validate_location_accuracy  | boolean| Require accuracy threshold          |
| notifications | attendance_logs_enabled   | boolean| Enable activity logs                |
| notifications | log_gps_attempts          | boolean| Log every check-in/check-out attempt |
| notifications | log_failed_attempts       | boolean| Log failed (out-of-range, late, etc.) |

### 2.3 Activity logging (optional but recommended)
- **Table**: `attendance_activity_logs`: `id`, `teacher_id` (nullable), `action` (check_in|check_out|attempt_failed), `timetable_id` (nullable), `payload` (json: coords, distance, within_range, reason), `ip_address`, `user_agent`, `timestamps`.
- Used when `attendance_logs_enabled` and/or `log_gps_attempts` / `log_failed_attempts` are true.

### 2.4 Role & access
- **Admin only**: System Settings UI and API are under `admin` routes; middleware `auth:web`, `verified`, and permission `admin.settings.view` (read) / `admin.settings.edit` (update).
- **Teachers**: No access to system settings; they only hit attendance endpoints. Optional future: “per-teacher overrides” stored elsewhere and checked in attendance logic (out of scope for first version).

### 2.5 API surface
- **GET** `admin/settings` — Returns all settings grouped (for dashboard UI). Only keys needed by frontend; sensitive keys (e.g. API key) can be masked.
- **GET** `admin/settings/{group}` — Optional; return one group.
- **PUT/PATCH** `admin/settings` — Request body: `{ group: 'general', settings: { institution_name: '...', timezone: '...' } }`. Validate by group; update only allowed keys; then clear cache and return updated settings.

### 2.6 Integration with attendance flow
- **TeacherAttendanceController** (check-in/check-out):
  - Resolve “effective” radius: classroom `radius_meters` if set, else `gps_radius_meters` from settings.
  - If `gps_enforcement_enabled` is true and `within_range` is false, reject check-in (and optionally log with `log_failed_attempts`).
  - Check-out: optionally enforce location using same radius and same setting.
  - Late: compare check-in time to `start_time + late_check_in_minutes`; set status to `late` when applicable.
  - Early leave: compare check-out time to `end_time - early_leave_minutes`; set status to `early_leave` when applicable.
  - If `attendance_logs_enabled` or `log_gps_attempts` / `log_failed_attempts`, write to `attendance_activity_logs` on each attempt (success or failure).
- **Frontend (teacher attendance)**: Can remain as-is; radius and rules are enforced server-side. Optionally show “system radius” in UI from a small public endpoint or from existing todays-classes (already sends radius per class).

### 2.7 Technical requirements checklist
- [x] Database migrations: `system_settings`, `attendance_activity_logs`
- [x] Models: `SystemSetting`, `AttendanceActivityLog`
- [x] Service or model helpers for get/set with cache
- [x] Controller + validation + policy
- [x] Permissions: `admin.settings.view`, `admin.settings.edit`; add to PermissionSeeder
- [x] Routes under admin, secured
- [x] Frontend: Admin Settings dashboard (tabs/sections for General, Attendance, Map, Notifications)
- [x] Attendance flow uses settings (radius, enforcement, late/early, logging)

---

## 3. File and route map (implementation)

- **Migrations**: `database/migrations/xxxx_create_system_settings_table.php`, `xxxx_create_attendance_activity_logs_table.php`
- **Models**: `App\Models\SystemSetting`, `App\Models\AttendanceActivityLog`
- **Seed**: `Database\Seeders\SystemSettingsSeeder` (default keys above)
- **Service** (optional): `App\Services\SystemSettingsService` or static helpers on `SystemSetting`
- **Controller**: `App\Http\Controllers\Admin\SystemSettingsController`
- **Policy**: `App\Policies\SystemSettingPolicy`
- **Requests**: `App\Http\Requests\Admin\SystemSettingsUpdateRequest` (or inline validation)
- **Routes**: in `web.php` under `prefix('admin')`: `Route::get('settings', ...)`, `Route::put('settings', ...)`
- **Frontend**: `resources/js/pages/admin/settings/index.tsx` (tabbed: General, Attendance, Map, Notifications)
- **Nav**: Add “System Settings” to `mainNavItems` in `app-header.tsx` with `admin.settings.view`

This design keeps the existing attendance flow intact, adds a single source of truth for system-wide options, and makes it easy to add more keys or groups later.
