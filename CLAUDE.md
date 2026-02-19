# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pressify Reprint is an Electron desktop application (React frontend) for managing print reprint operations. It communicates with a Laravel Vanguard API backend (`D:\xampp\htdocs\LaravelVanguard`) via REST API using Sanctum token authentication. The app has role-based access control for 11 roles: admin, user, seller, supplier, staff, support, designer, printer, cuter, picker, presser.

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
  ├── Settings via electron-store ("pressify-settings") → apiBaseUrl, apiTimeout
  ├── API client init (src/main/api-client.js → Laravel Vanguard REST API)
  ├── IPC handlers proxy all db/auth/settings calls to API (src/main/ipc-handlers.js)
  ├── Token storage (src/main/token-store.js → electron-store + safeStorage)
  ├── Auto-updater (update-electron-app, checks GitHub Releases, production only)
  └── Logger (src/main/logger.js, writes to userData/logs/, rotates at 5MB)

Preload (src/main/preload.js)
  └── Exposes window.electronAPI:
      ├── getAppVersion(), installUpdate(), log()
      ├── settings.{get,save,reset,testConnection}
      ├── auth.{login,logout,refresh,validate,me,openWeb,getStatus}
      └── db.{users,roles,reprints,productReprints,colorReprints,sizeReprints,userReprints,reasons,orderTypes,timelines}.*

Renderer Process (src/renderer/)
  ├── index.jsx → React entry point
  ├── App.jsx → HashRouter + route definitions with role-based guards
  ├── contexts/AuthContext.jsx → Auth state, login/logout, token refresh, session persistence (localStorage)
  └── components/ → Page components (no direct DB/API access, all via IPC)
```

### Configuration

Settings are stored via `electron-store` (store name: `pressify-settings`), **not** `.env` files. The admin Settings page allows runtime configuration.

- **Default API URL:** `https://hub.pressify.us`
- **Default timeout:** 10000ms
- API client enforces HTTPS except for `localhost`/`127.0.0.1` (dev mode)
- Settings persist across app restarts; `settings:reset` reverts to defaults

### Data Layer

All data operations go through IPC: renderer calls `window.electronAPI.db.*` → preload → ipcMain handlers in `ipc-handlers.js` → `api-client.js` → Laravel Vanguard REST API. Components fetch data on mount and reload after mutations.

**Database tables (managed by Laravel):** `users`, `roles`, `reprints`, `product_reprint`, `color_reprint`, `size_reprint`, `reason_reprints`, `order_types`, `reprint_timelines`, `personal_access_tokens`

### IPC → REST Mapping

All CRUD resources follow the same pattern: `getAll` → GET, `create` → POST, `update` → PUT, `delete` → DELETE.

| Resource | API Base Path |
|----------|---------------|
| users | `/api/reprint-users` (also `count` endpoint) |
| roles | `/api/reprint-roles` (read-only) |
| reprints | `/api/reprints` |
| productReprints | `/api/product-reprints` |
| colorReprints | `/api/color-reprints` |
| sizeReprints | `/api/size-reprints` |
| userReprints | `/api/user-reprints` |
| reasons | `/api/reasons` |
| orderTypes | `/api/order-types` |
| timelines | `/api/timelines/{reprintId}` (getByReprint) / `/api/timelines` (create) |

**Auth endpoints:** `POST /api/login`, `POST /api/logout`, `GET /api/me`

**Settings IPC:** `settings:get`, `settings:save`, `settings:reset`, `settings:testConnection` (tests server reachability via `GET /api/me`)

### API Response Format

All CRUD endpoints return data as **objects keyed by ID** (e.g. `{"1": {"name": "..."}, "2": {...}}`), except:
- **Timelines** return an **array** (ordered by id DESC)
- **Login** returns `{token, user: {uid, username, name, role, role_id}}`
- **Create** endpoints return `{id: "..."}` (string ID)
- **Update/Delete** endpoints return `{success: true}`

### Authentication

- Sanctum token-based auth via Laravel Vanguard API
- Login sends `{username, password, device_name: "electron-app"}` to `POST /api/login`
- Token stored encrypted locally via electron-store (`pressify-auth`) + safeStorage
- Token attached as `Authorization: Bearer <token>` header on all API requests
- Session also persisted in renderer localStorage (`pressify_user` key)
- 401 responses throw `SESSION_EXPIRED` error code (renderer handles redirect to login)
- Auto-refresh every 30 minutes via `auth:refresh` (validates token with `GET /api/me`)
- API client also handles 429 rate limiting with `Retry-After` header

### Routing

Uses `HashRouter` (required for Electron's `file://` protocol). Routes are wrapped in a `PrivateRoute` component that checks auth state and role permissions.

- `/reprints` — All authenticated users (default route after login)
- `/dashboard`, `/products`, `/permission`, `/settings` — Admin only
- Non-admin users are redirected to `/reprints` if they try to access admin routes

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
| `Settings.jsx` | Admin-only API connection settings (URL, timeout, test connection) |
| `Timeline.jsx` | Activity log per reprint with VN/US timezone display |

### Build Pipeline

Electron Forge + Webpack bundles the app. Babel handles JSX transpilation (`@babel/preset-react`, `@babel/preset-env`). Separate webpack configs for main process (`webpack.main.config.js`) and renderer (`webpack.renderer.config.js`). Main process uses `node-loader` for `.node` files. Renderer handles `.jsx`, `.css`, and image assets.

### CI/CD

GitHub Actions (`.github/workflows/build.yml`) triggers on `v*` tags, builds on Windows/macOS/Linux with Node 20, runs `npm run make`, and uploads artifacts to GitHub Releases. The app's auto-updater then picks up new releases via `update-electron-app`.

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

routes/api.php  (all reprint routes under auth+verified middleware)
```
