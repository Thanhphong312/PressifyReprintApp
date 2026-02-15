# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pressify Reprint is an Electron desktop application (React frontend) for managing print reprint operations. It communicates with a Laravel Vanguard API backend (`D:\xampp\htdocs\LaravelVanguard`) via REST API using Sanctum token authentication. The app has role-based access control for 11 roles: admin, user, seller, supplier, staff, support, designer, printer, cuter, picker, processer.

## Commands

- `npm start` — Run in development mode with hot reload (electron-forge start)
- `npm run package` — Package the app for distribution
- `npm run make` — Create platform installers (Squirrel/ZIP/DEB)
- `npm run publish` — Publish to GitHub Releases

There is no test framework configured. No lint tooling is set up.

### Laravel Backend

```bash
cd D:\xampp\htdocs\LaravelVanguard
php artisan serve          # Start API at http://127.0.0.1:8000
php artisan migrate        # Run database migrations
php artisan db:seed --class=ReprintRolesSeeder  # Seed reprint-specific roles
```

## Architecture

### Process Model (Electron)

```
Main Process (src/main/main.js)
  ├── Window creation (contextIsolation=true, nodeIntegration=false)
  ├── dotenv loading (.env → API_BASE_URL, API_TIMEOUT)
  ├── API client init (src/main/api-client.js → Laravel Vanguard REST API)
  ├── IPC handlers proxy all db/auth calls to API (src/main/ipc-handlers.js)
  ├── Token storage (src/main/token-store.js → electron-store + safeStorage)
  ├── Auto-updater (electron-updater, checks GitHub Releases)
  └── Logger (src/main/logger.js, writes to userData/logs/)

Preload (src/main/preload.js)
  └── Exposes window.electronAPI:
      ├── getAppVersion(), installUpdate(), log()
      ├── auth.{login,logout,refresh,validate,me,openWeb,getStatus}
      └── db.{users,roles,reprints,productReprints,colorReprints,sizeReprints,reasons,orderTypes,timelines}.*

Renderer Process (src/renderer/)
  ├── index.jsx → React entry point
  ├── App.jsx → HashRouter + route definitions with role-based guards
  ├── contexts/AuthContext.jsx → Auth state, login/logout, token refresh, session persistence (localStorage)
  └── components/ → Page components (no direct DB/API access, all via IPC)
```

### Data Layer

All data operations go through IPC: renderer calls `window.electronAPI.db.*` → preload → ipcMain handlers in `ipc-handlers.js` → `api-client.js` → Laravel Vanguard REST API. Components fetch data on mount and reload after mutations.

**API Backend:** Laravel Vanguard at `API_BASE_URL` (default `http://127.0.0.1:8000`)

**Database tables (managed by Laravel):** `users`, `roles`, `reprints`, `product_reprint`, `color_reprint`, `size_reprint`, `reason_reprints`, `order_types`, `reprint_timelines`, `personal_access_tokens`

**Config:** `.env` file at project root (bundled as extraResource in production builds)
```
API_BASE_URL=http://127.0.0.1:8000
API_TIMEOUT=10000
```

### API Endpoints (IPC → REST mapping)

| IPC Channel | HTTP Method | API Route |
|-------------|-------------|-----------|
| `auth:login` | POST | `/api/login` |
| `auth:logout` | POST | `/api/logout` |
| `auth:validate` | GET | `/api/me` |
| `auth:me` | GET | `/api/me` |
| `db:users:getAll` | GET | `/api/reprint-users` |
| `db:users:count` | GET | `/api/reprint-users/count` |
| `db:users:create` | POST | `/api/reprint-users` |
| `db:users:update` | PUT | `/api/reprint-users/{id}` |
| `db:users:delete` | DELETE | `/api/reprint-users/{id}` |
| `db:roles:getAll` | GET | `/api/reprint-roles` |
| `db:reprints:getAll` | GET | `/api/reprints` |
| `db:reprints:create` | POST | `/api/reprints` |
| `db:reprints:update` | PUT | `/api/reprints/{id}` |
| `db:reprints:delete` | DELETE | `/api/reprints/{id}` |
| `db:productReprints:getAll` | GET | `/api/product-reprints` |
| `db:productReprints:create` | POST | `/api/product-reprints` |
| `db:productReprints:update` | PUT | `/api/product-reprints/{id}` |
| `db:productReprints:delete` | DELETE | `/api/product-reprints/{id}` |
| `db:colorReprints:getAll` | GET | `/api/color-reprints` |
| `db:colorReprints:create` | POST | `/api/color-reprints` |
| `db:colorReprints:update` | PUT | `/api/color-reprints/{id}` |
| `db:colorReprints:delete` | DELETE | `/api/color-reprints/{id}` |
| `db:sizeReprints:getAll` | GET | `/api/size-reprints` |
| `db:sizeReprints:create` | POST | `/api/size-reprints` |
| `db:sizeReprints:update` | PUT | `/api/size-reprints/{id}` |
| `db:sizeReprints:delete` | DELETE | `/api/size-reprints/{id}` |
| `db:reasons:getAll` | GET | `/api/reasons` |
| `db:reasons:create` | POST | `/api/reasons` |
| `db:reasons:update` | PUT | `/api/reasons/{id}` |
| `db:reasons:delete` | DELETE | `/api/reasons/{id}` |
| `db:orderTypes:getAll` | GET | `/api/order-types` |
| `db:orderTypes:create` | POST | `/api/order-types` |
| `db:orderTypes:update` | PUT | `/api/order-types/{id}` |
| `db:orderTypes:delete` | DELETE | `/api/order-types/{id}` |
| `db:timelines:getByReprint` | GET | `/api/timelines/{reprintId}` |
| `db:timelines:create` | POST | `/api/timelines` |

### API Response Format

All CRUD endpoints return data as **objects keyed by ID** (e.g. `{"1": {"name": "..."}, "2": {...}}`), except:
- **Timelines** return an **array** (ordered by id DESC)
- **Login** returns `{token, user: {uid, username, name, role, role_id}}`
- **Create** endpoints return `{id: "..."}` (string ID)
- **Update/Delete** endpoints return `{success: true}`

### Authentication

- Sanctum token-based auth via Laravel Vanguard API
- Login sends `{username, password, device_name: "electron-app"}` to `POST /api/login`
- Token stored encrypted locally via electron-store + safeStorage
- Token attached as `Authorization: Bearer <token>` header on all API requests
- Session also persisted in localStorage (renderer side)
- 401 responses trigger session expiry (redirect to login)
- Auto-refresh every 30 minutes via `auth:refresh` (validates token with `GET /api/me`)
- Roles control route access: admin gets all pages; support/designer/printer see only the Reprint page

### Routing

Uses `HashRouter` (required for Electron's `file://` protocol). Routes are wrapped in a `PrivateRoute` component that checks auth state and role permissions.

### Key Components

| Component | Purpose |
|-----------|---------|
| `Layout.jsx` | Collapsible sidebar + topbar shell |
| `Dashboard.jsx` | Stats cards + Chart.js charts (by status, reason, support user) |
| `ReprintList.jsx` | Main CRUD table for reprints with search/filter/status |
| `ReprintForm.jsx` | Modal form for add/edit reprint records |
| `ProductList.jsx` | Product, Color & Size management (3 independent lists) |
| `ProductImport.jsx` | CSV import via PapaParse (expects columns: product_name, color, size) |
| `Permission.jsx` | Admin-only user/reason/order-type management |
| `Timeline.jsx` | Activity log per reprint with VN/US timezone display |

### Build Pipeline

Electron Forge + Webpack bundles the app. Babel handles JSX transpilation (`@babel/preset-react`, `@babel/preset-env`). Separate webpack configs for main process (`webpack.main.config.js`, with dotenv/electron-store as externals) and renderer (`webpack.renderer.config.js`).

### CI/CD

GitHub Actions (`.github/workflows/build.yml`) triggers on `v*` tags, builds on Windows/macOS/Linux with Node 20, runs `npm run make`, and uploads artifacts to GitHub Releases. The app's auto-updater then picks up new releases via `electron-updater`.

### Reprint Status Flow

Reprints move through: `not_yet` → `processing` → `completed` → `printed`

### Laravel Backend Structure (D:\xampp\htdocs\LaravelVanguard)

```
app/
  ├── Reprint.php, ReasonReprint.php, OrderType.php, ReprintTimeline.php  (reprint models)
  ├── ProductReprint.php, ColorReprint.php, SizeReprint.php  (product/color/size reprint models)
  ├── User.php, Role.php, Permission.php  (existing Vanguard models)
  └── Http/Controllers/Api/
      ├── Auth/AuthController.php  (login returns {token, user}, device_name optional)
      └── Reprint/
          ├── ReprintController.php
          ├── ProductReprintController.php
          ├── ColorReprintController.php
          ├── SizeReprintController.php
          ├── ReasonReprintController.php
          ├── OrderTypeController.php
          ├── ReprintTimelineController.php
          ├── ReprintUserController.php
          └── ReprintRoleController.php

database/migrations/
  ├── 2026_02_15_000001_create_reason_reprints_table.php
  ├── 2026_02_15_000002_create_order_types_table.php
  ├── 2026_02_15_000003_create_reprints_table.php
  ├── 2026_02_15_000004_create_reprint_timelines_table.php
  ├── 2026_02_15_000006_create_product_reprint_table.php
  ├── 2026_02_15_000007_create_color_reprint_table.php
  ├── 2026_02_15_000008_create_size_reprint_table.php
  └── 2026_02_15_000009_alter_reprints_add_product_color_size_reprint_ids.php

database/seeders/
  └── ReprintRolesSeeder.php  (adds Printer, Cuter, Picker, Processer roles + reprints.manage permission)

routes/api.php  (all reprint routes under auth+verified middleware)
```
