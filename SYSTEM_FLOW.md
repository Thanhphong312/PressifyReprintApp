# Pressify Reprint — System Flow Document

Tài liệu mô tả chi tiết toàn bộ flow hoạt động của hệ thống Pressify Reprint, bao gồm Electron desktop app và Laravel API backend.

---

## Table of Contents

1. [Kiến trúc tổng quan](#1-kiến-trúc-tổng-quan)
2. [Khởi động ứng dụng (App Startup)](#2-khởi-động-ứng-dụng-app-startup)
3. [Authentication Flow](#3-authentication-flow)
4. [Token Lifecycle](#4-token-lifecycle)
5. [SSO Flow (Electron → Web)](#5-sso-flow-electron--web)
6. [Data Flow (CRUD Operations)](#6-data-flow-crud-operations)
7. [Reprint Status Flow](#7-reprint-status-flow)
8. [Role-Based Access Control](#8-role-based-access-control)
9. [Error Handling Flow](#9-error-handling-flow)
10. [Auto-Update Flow](#10-auto-update-flow)
11. [File Map](#11-file-map)

---

## 1. Kiến trúc tổng quan

```
┌──────────────────────────────────────────────────────────────┐
│                     ELECTRON APP                             │
│                                                              │
│  ┌──────────────┐    IPC Bridge    ┌───────────────────────┐ │
│  │  Renderer     │◄──────────────►│  Main Process          │ │
│  │  (React)      │   preload.js    │                       │ │
│  │               │                 │  ┌─────────────────┐  │ │
│  │  - Login      │                 │  │ ipc-handlers.js │  │ │
│  │  - Dashboard  │                 │  │                 │  │ │
│  │  - ReprintList│                 │  │  auth:login     │  │ │
│  │  - Products   │                 │  │  auth:logout    │  │ │
│  │  - Permission │                 │  │  auth:refresh   │  │ │
│  │               │                 │  │  auth:validate  │  │ │
│  │  AuthContext   │                 │  │  db:*           │  │ │
│  │  (session +   │                 │  └──────┬──────────┘  │ │
│  │   refresh     │                 │         │              │ │
│  │   timer)      │                 │    SSO? │ MySQL?       │ │
│  └──────────────┘                 │    ┌────┴────┐         │ │
│                                    │    ▼         ▼         │ │
│                                    │ ┌───────┐ ┌────────┐  │ │
│                                    │ │ API   │ │ MySQL  │  │ │
│                                    │ │Client │ │ Pool   │  │ │
│                                    │ └───┬───┘ └───┬────┘  │ │
│                                    │     │         │        │ │
│                                    └─────┼─────────┼────────┘ │
└──────────────────────────────────────────┼─────────┼──────────┘
                                           │         │
                              HTTPS/HTTP   │         │  TCP 3306
                                           ▼         ▼
                                    ┌────────────────────────┐
                                    │     Laravel API        │
                                    │     (Sanctum)          │
                                    │                        │
                                    │  POST /api/auth/login  │
                                    │  POST /api/auth/logout │
                                    │  POST /api/auth/refresh│
                                    │  GET  /api/auth/me     │
                                    │  POST /api/auth/validate│
                                    │  POST /api/auth/sso-code│
                                    │  POST /api/auth/sso-exchange│
                                    │  GET  /sso/callback    │
                                    └───────────┬────────────┘
                                                │
                                                ▼
                                    ┌────────────────────────┐
                                    │   MySQL Database       │
                                    │   (pressify)           │
                                    │                        │
                                    │   users                │
                                    │   roles                │
                                    │   reprints             │
                                    │   products             │
                                    │   product_variants     │
                                    │   reason_reprints      │
                                    │   order_types          │
                                    │   timelines            │
                                    │   personal_access_tokens│
                                    │   sso_codes            │
                                    └────────────────────────┘
```

**Key point:** Electron app và Laravel API dùng **chung 1 MySQL database** (`pressify`). Electron kết nối trực tiếp qua `mysql2` cho CRUD operations, còn Laravel xử lý authentication qua Sanctum tokens.

---

## 2. Khởi động ứng dụng (App Startup)

```
app.whenReady()
    │
    ▼
┌─────────────────────────┐
│ 1. Load .env config     │  database.js → loadEnv()
│    DB_HOST, DB_DATABASE  │  (.env at project root or resourcesPath)
│    API_BASE_URL          │
│    SSO_ENABLED           │
└────────┬────────────────┘
         ▼
┌─────────────────────────┐
│ 2. Create MySQL Pool    │  database.js → createPool()
│    connectionLimit: 10   │  mysql2/promise
└────────┬────────────────┘
         ▼
┌─────────────────────────┐
│ 3. Init API Client?     │  SSO_ENABLED=true → apiClient.init(baseUrl, timeout)
│    (conditional)         │  SSO_ENABLED=false → skip, MySQL auth only
└────────┬────────────────┘
         ▼
┌─────────────────────────┐
│ 4. Register IPC handlers│  ipc-handlers.js → registerHandlers()
│    auth:* + db:*         │  Tất cả handlers available cho renderer
└────────┬────────────────┘
         ▼
┌─────────────────────────┐
│ 5. Create BrowserWindow │  contextIsolation: true
│                          │  nodeIntegration: false
│                          │  preload: preload.js
└────────┬────────────────┘
         ▼
┌─────────────────────────┐
│ 6. Load React app        │  MAIN_WINDOW_WEBPACK_ENTRY
│    (renderer process)    │  HashRouter (file:// compatible)
└────────┬────────────────┘
         ▼
┌─────────────────────────────────────────────────────┐
│ 7. AuthProvider mounts → restoreSession()           │
│                                                      │
│    a. Check localStorage('pressify_user')            │
│       ├── Không có → setLoading(false) → Show Login  │
│       └── Có userData →                              │
│                                                      │
│    b. auth:get-status → { ssoEnabled, hasToken }     │
│       ├── SSO enabled + hasToken →                   │
│       │   auth:validate → API /api/auth/validate     │
│       │   ├── valid: true → setCurrentUser()         │
│       │   │   + startRefreshTimer(30min)             │
│       │   └── valid: false → clearSession()          │
│       │       → Show Login                           │
│       ├── SSO disabled → trust localStorage          │
│       │   → setCurrentUser(userData)                 │
│       └── API unreachable → trust localStorage       │
│           (graceful fallback)                        │
└─────────────────────────────────────────────────────┘
```

**Quan trọng:** Khi SSO disabled hoặc API không reachable, app vẫn hoạt động bình thường bằng MySQL auth trực tiếp. Đây là fallback mechanism.

---

## 3. Authentication Flow

### 3.1. Login Flow — SSO Enabled

```
User                   Login.jsx         AuthContext         IPC Handler         API Client          Laravel API
  │                        │                  │                   │                   │                    │
  │ Enter username/pwd     │                  │                   │                    │                    │
  │───────────────────────►│                  │                   │                    │                    │
  │                        │ login(u, p)      │                   │                    │                    │
  │                        │─────────────────►│                   │                    │                    │
  │                        │                  │ auth:login        │                    │                    │
  │                        │                  │──────────────────►│                    │                    │
  │                        │                  │                   │ isSsoEnabled()?    │                    │
  │                        │                  │                   │ → YES              │                    │
  │                        │                  │                   │ apiClient.login()  │                    │
  │                        │                  │                   │──────────────────►│                    │
  │                        │                  │                   │                   │ POST /api/auth/login│
  │                        │                  │                   │                   │───────────────────►│
  │                        │                  │                   │                   │                    │
  │                        │                  │                   │                   │                    │ Verify bcrypt
  │                        │                  │                   │                   │                    │ Delete old tokens
  │                        │                  │                   │                    │                    │ Create Sanctum token
  │                        │                  │                   │                   │                    │
  │                        │                  │                   │                   │◄───────────────────│
  │                        │                  │                   │                   │ { token, user }    │
  │                        │                  │                   │                   │                    │
  │                        │                  │                   │                   │ tokenStore.store   │
  │                        │                  │                   │                   │ (encrypted via     │
  │                        │                  │                   │                   │  safeStorage)      │
  │                        │                  │                   │◄──────────────────│                    │
  │                        │                  │                   │ { user, sso:true } │                    │
  │                        │                  │◄──────────────────│                    │                    │
  │                        │                  │                   │                    │                    │
  │                        │                  │ setCurrentUser()  │                    │                    │
  │                        │                  │ localStorage.set  │                    │                    │
  │                        │                  │ startRefreshTimer │                    │                    │
  │                        │◄─────────────────│                   │                    │                    │
  │                        │ userData          │                   │                    │                    │
  │◄───────────────────────│                  │                   │                    │                    │
  │ Navigate to /reprints  │                  │                   │                    │                    │
```

### 3.2. Login Flow — SSO Disabled (MySQL Only)

```
User                   Login.jsx         AuthContext         IPC Handler         MySQL
  │                        │                  │                   │                 │
  │ Enter username/pwd     │                  │                   │                 │
  │───────────────────────►│                  │                   │                 │
  │                        │ login(u, p)      │                   │                 │
  │                        │─────────────────►│                   │                 │
  │                        │                  │ auth:login        │                 │
  │                        │                  │──────────────────►│                 │
  │                        │                  │                   │ isSsoEnabled()? │
  │                        │                  │                   │ → NO            │
  │                        │                  │                   │                 │
  │                        │                  │                   │ SELECT u.*, r.name
  │                        │                  │                   │ FROM users u     │
  │                        │                  │                   │ LEFT JOIN roles r│
  │                        │                  │                   │ WHERE username=? │
  │                        │                  │                   │ AND status='Active'
  │                        │                  │                   │────────────────►│
  │                        │                  │                   │◄────────────────│
  │                        │                  │                   │ user row        │
  │                        │                  │                   │                 │
  │                        │                  │                   │ bcrypt.compareSync()
  │                        │                  │                   │ → match!        │
  │                        │                  │                   │                 │
  │                        │                  │◄──────────────────│                 │
  │                        │                  │ { user, sso:false}│                 │
  │                        │                  │                   │                 │
  │                        │                  │ setCurrentUser()  │                 │
  │                        │                  │ localStorage.set  │                 │
  │                        │                  │ (no refresh timer)│                 │
  │                        │◄─────────────────│                   │                 │
  │◄───────────────────────│                  │                   │                 │
  │ Navigate to /reprints  │                  │                   │                 │
```

**Khác biệt chính:**
- SSO Enabled: Token lưu encrypted trong `electron-store`, auto-refresh mỗi 30 phút
- SSO Disabled: Không có token, session chỉ dựa vào `localStorage`, không có refresh timer

### 3.3. Logout Flow

```
User                   Component          AuthContext         IPC Handler         API Client          Laravel API
  │                        │                  │                   │                   │                    │
  │ Click Logout           │                  │                   │                    │                    │
  │───────────────────────►│                  │                   │                    │                    │
  │                        │ logout()          │                   │                    │                    │
  │                        │─────────────────►│                   │                    │                    │
  │                        │                  │ auth:logout       │                    │                    │
  │                        │                  │──────────────────►│                    │                    │
  │                        │                  │                   │                    │                    │
  │                        │                  │                   │ [SSO]              │                    │
  │                        │                  │                   │ apiClient.logout() │                    │
  │                        │                  │                   │──────────────────►│                    │
  │                        │                  │                   │                   │ POST /auth/logout  │
  │                        │                  │                   │                   │──────────────────►│
  │                        │                  │                   │                   │                    │ Delete current token
  │                        │                  │                   │                   │◄──────────────────│
  │                        │                  │                   │◄──────────────────│                    │
  │                        │                  │                   │ tokenStore.clearAll()                  │
  │                        │                  │                   │ (clear encrypted store)                │
  │                        │                  │◄──────────────────│                    │                    │
  │                        │                  │                   │                    │                    │
  │                        │                  │ setCurrentUser(null)                   │                    │
  │                        │                  │ localStorage.remove('pressify_user')   │                    │
  │                        │                  │ clearInterval(refreshTimer)            │                    │
  │                        │◄─────────────────│                   │                    │                    │
  │◄───────────────────────│                  │                   │                    │                    │
  │ Navigate to /login     │                  │                   │                    │                    │
```

**Note:** Nếu API logout call fail (network error), app vẫn clear local state. Đảm bảo user luôn có thể logout.

---

## 4. Token Lifecycle

### 4.1. Token Storage

```
┌─────────────────────────────────────────────────────┐
│              Token Store (electron-store)             │
│              File: pressify-auth.json                │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  auth_token: "base64_encrypted_string"      │    │
│  │  auth_token_encrypted: true                  │    │
│  │  auth_token_stored_at: 1704067200000        │    │
│  │  user_data: { id, username, role, ... }     │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  Encryption:                                         │
│  - safeStorage.isEncryptionAvailable() → true:      │
│    Token encrypted via OS keychain (DPAPI/Keychain)  │
│  - safeStorage unavailable → plaintext fallback     │
└─────────────────────────────────────────────────────┘
```

### 4.2. Token Refresh Cycle

```
                    ┌─────────────┐
                    │ Login       │
                    │ success     │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Store token │  tokenStore.storeToken()
                    │ (encrypted) │  electron-store + safeStorage
                    └──────┬──────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ Start 30-min interval  │  AuthContext → setInterval()
              └────────────┬───────────┘
                           │
              ┌────────────┼────── ... 30 min later ...
              │            ▼
              │  ┌──────────────────┐
              │  │ auth:refresh     │  IPC → apiClient.refresh()
              │  └────────┬─────────┘
              │           │
              │           ▼
              │  ┌──────────────────────────────────────┐
              │  │ POST /api/auth/refresh               │
              │  │ Authorization: Bearer <old-token>    │
              │  │                                      │
              │  │ Laravel:                              │
              │  │  1. Delete current token from DB     │
              │  │  2. Create new token (7 day expiry)  │
              │  │  3. Return { token, user }           │
              │  └────────┬─────────────────────────────┘
              │           │
              │           ▼
              │  ┌──────────────────┐
              │  │ Store new token  │  tokenStore.storeToken(newToken)
              │  │ (replace old)    │
              │  └────────┬─────────┘
              │           │
              └───────────┘ (repeat every 30 min)

              ┌─────────────────────────────────┐
              │ If refresh fails:                │
              │  → AuthContext.clearSession()    │
              │  → User redirected to /login     │
              └─────────────────────────────────┘
```

### 4.3. Auto-Retry on 401

```
Any API request (e.g. GET /api/auth/me)
    │
    ▼
┌────────────────────┐
│ Response: 401      │
│ Unauthenticated    │
└────────┬───────────┘
         │
         │  Is this a login/refresh request?
         │  ├── YES → throw SESSION_EXPIRED (no retry)
         │  └── NO ↓
         │
         ▼
┌────────────────────┐
│ Auto-refresh token │  POST /api/auth/refresh
└────────┬───────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
  Success    Fail
    │         │
    ▼         ▼
┌────────┐ ┌───────────────┐
│ Retry  │ │ throw         │
│ orig.  │ │ SESSION_EXPIRED│
│ request│ │               │
│ w/ new │ │ → User logged │
│ token  │ │   out         │
└────────┘ └───────────────┘
```

---

## 5. SSO Flow (Electron → Web)

SSO cho phép user đang đăng nhập trong Electron app mở browser và tự động đăng nhập vào web app mà không cần nhập lại credentials.

```
Electron App                         Laravel API                      Browser
    │                                     │                               │
    │ User clicks "Open Web"              │                               │
    │                                     │                               │
    │ 1. auth:sso-web (IPC)              │                               │
    │    └─ apiClient.generateSsoCode()  │                               │
    │       POST /api/auth/sso-code      │                               │
    │──────────────────────────────────►│                               │
    │                                     │                               │
    │                                     │ Create SsoCode record:       │
    │                                     │   code: random(64)           │
    │                                     │   user_id: current user      │
    │                                     │   expires_at: now + 5 min    │
    │                                     │   used: false                │
    │                                     │                               │
    │◄──────────────────────────────────│                               │
    │ { code: "aB3xY7kLm..." }          │                               │
    │                                     │                               │
    │ 2. Construct URL:                   │                               │
    │    {baseUrl}/sso/callback           │                               │
    │    ?code=aB3xY7kLm...              │                               │
    │                                     │                               │
    │ 3. shell.openExternal(url)          │                               │
    │────────────────────────────────────────────────────────────────────►│
    │                                     │                               │
    │                                     │  4. GET /sso/callback?code=..│
    │                                     │◄──────────────────────────────│
    │                                     │                               │
    │                                     │  5. Validate code:           │
    │                                     │     - Exists in DB?          │
    │                                     │     - Not expired?           │
    │                                     │     - Not used?              │
    │                                     │     → YES to all             │
    │                                     │                               │
    │                                     │  6. Mark code as used        │
    │                                     │     Load user                │
    │                                     │     Check user.isActive()    │
    │                                     │                               │
    │                                     │  7. auth()->login(user)      │
    │                                     │     (create web session)     │
    │                                     │                               │
    │                                     │  8. Redirect 302 → /dashboard│
    │                                     │──────────────────────────────►│
    │                                     │                               │
    │                                     │                               │ User sees dashboard
    │                                     │                               │ (logged in, no pwd needed)
```

**Security notes:**
- SSO code là one-time use, hết hạn sau 5 phút
- Code dài 64 ký tự random (Str::random(64)), brute-force không khả thi
- Expired codes được tự động cleanup khi tạo code mới

---

## 6. Data Flow (CRUD Operations)

Mọi data operation đi qua IPC bridge. Renderer **không bao giờ** truy cập trực tiếp MySQL.

### 6.1. Read Flow (ví dụ: Load reprints)

```
ReprintList.jsx                preload.js              ipc-handlers.js              MySQL
    │                              │                        │                         │
    │ useEffect() on mount         │                        │                         │
    │                              │                        │                         │
    │ window.electronAPI           │                        │                         │
    │   .db.reprints.getAll()      │                        │                         │
    │─────────────────────────────►│                        │                         │
    │                              │ ipcRenderer.invoke     │                         │
    │                              │ ('db:reprints:getAll') │                         │
    │                              │───────────────────────►│                         │
    │                              │                        │                         │
    │                              │                        │ pool.execute(            │
    │                              │                        │  'SELECT * FROM reprints │
    │                              │                        │   ORDER BY created_at    │
    │                              │                        │   DESC')                 │
    │                              │                        │────────────────────────►│
    │                              │                        │◄────────────────────────│
    │                              │                        │ rows[]                   │
    │                              │                        │                         │
    │                              │                        │ rowsToObject(rows)       │
    │                              │                        │ → { "1": {...}, "2": ...}│
    │                              │◄───────────────────────│                         │
    │◄─────────────────────────────│                        │                         │
    │ data = { "1": {...}, ... }   │                        │                         │
    │                              │                        │                         │
    │ setState(data)               │                        │                         │
    │ Render table                 │                        │                         │
```

### 6.2. Write Flow (ví dụ: Create reprint)

```
ReprintForm.jsx               preload.js              ipc-handlers.js              MySQL
    │                              │                        │                         │
    │ Submit form                  │                        │                         │
    │                              │                        │                         │
    │ window.electronAPI           │                        │                         │
    │   .db.reprints.create({      │                        │                         │
    │     support_id, order_id,    │                        │                         │
    │     reason_reprint_id, ...   │                        │                         │
    │   })                         │                        │                         │
    │─────────────────────────────►│                        │                         │
    │                              │ ipcRenderer.invoke     │                         │
    │                              │ ('db:reprints:create', │                         │
    │                              │  data)                 │                         │
    │                              │───────────────────────►│                         │
    │                              │                        │                         │
    │                              │                        │ INSERT INTO reprints     │
    │                              │                        │ (...) VALUES (...)       │
    │                              │                        │────────────────────────►│
    │                              │                        │◄────────────────────────│
    │                              │                        │ insertId                 │
    │                              │◄───────────────────────│                         │
    │◄─────────────────────────────│                        │                         │
    │ newId = "123"                │                        │                         │
    │                              │                        │                         │
    │ Reload list                  │                        │                         │
    │ (call getAll again)          │                        │                         │
```

### 6.3. Data Format Convention

IPC handlers trả về data dạng **object map** (không phải array):

```javascript
// Input từ MySQL:
[
  { id: 1, name: "Product A" },
  { id: 2, name: "Product B" },
]

// Output qua IPC (rowsToObject):
{
  "1": { name: "Product A" },
  "2": { name: "Product B" },
}

// Tất cả *_id fields được convert sang String:
//   role_id: 3  →  role_id: "3"
```

### 6.4. DB_PREFIX Support

Tất cả table names đi qua hàm `t()` để support multi-tenant:

```javascript
// database.js
function t(table) {
  return `${process.env.DB_PREFIX || ''}${table}`;
}

// Ví dụ: DB_PREFIX=company1_
// t('users') → 'company1_users'
// t('reprints') → 'company1_reprints'
```

---

## 7. Reprint Status Flow

Reprint records chuyển qua 4 trạng thái:

```
┌───────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
│  not_yet  │────►│  processing  │────►│  completed  │────►│  printed │
│           │     │              │     │             │     │          │
│ Mới tạo,  │     │ Đang xử lý  │     │ Đã xử lý   │     │ Đã in   │
│ chưa xử lý│     │              │     │ xong        │     │ xong     │
└───────────┘     └──────────────┘     └─────────────┘     └──────────┘

Mỗi thay đổi status tạo 1 record trong bảng timelines:
  - user_id: ai thay đổi
  - reprint_id: reprint nào
  - note: mô tả thay đổi
  - time_vn: timestamp UTC+7
  - time_us: timestamp UTC-5
```

---

## 8. Role-Based Access Control

### 8.1. Route Access Matrix

```
              admin    support   designer   printer   cuter    picker   processer
              ─────    ───────   ────────   ───────   ─────    ──────   ─────────
/dashboard      ✓         ✗         ✗         ✗        ✗        ✗         ✗
/reprints       ✓         ✓         ✓         ✓        ✓        ✓         ✓
/products       ✓         ✗         ✗         ✗        ✗        ✗         ✗
/permission     ✓         ✗         ✗         ✗        ✗        ✗         ✗
```

### 8.2. Route Guard Flow

```
User navigates to /dashboard
        │
        ▼
PrivateRoute({ roles: ['admin'] })
        │
        ├── currentUser === null?
        │   └── YES → Navigate to /login
        │
        ├── currentUser.role in roles?
        │   ├── YES → Render <Dashboard />
        │   └── NO  → Navigate to /reprints (default page)
        │
```

### 8.3. Auth State Storage

```
┌──────────────────────────────────────────┐
│          Session State Locations          │
│                                          │
│  Renderer (React):                       │
│  ├── AuthContext.currentUser             │
│  │   { uid, username, name, role,        │
│  │     role_id }                         │
│  └── localStorage['pressify_user']       │
│      (JSON string, persists across       │
│       app restarts)                      │
│                                          │
│  Main Process:                           │
│  ├── tokenStore (electron-store)         │
│  │   auth_token (encrypted)              │
│  │   user_data                           │
│  └── Only used when SSO enabled          │
│                                          │
│  Server (Laravel):                       │
│  └── personal_access_tokens table        │
│      (SHA256 hash of token)              │
└──────────────────────────────────────────┘
```

---

## 9. Error Handling Flow

### 9.1. Login Errors

```
Login attempt
    │
    ├── NETWORK_ERROR (cannot connect to API)
    │   └── "Cannot connect to server. Please check your network connection."
    │
    ├── TIMEOUT (API_TIMEOUT exceeded, default 10s)
    │   └── "Server is not responding. Please try again later."
    │
    ├── RATE_LIMITED (429 — throttle:5,1 on Laravel)
    │   └── "Rate limited. Try again in {retryAfter} seconds."
    │
    ├── 401 INVALID_CREDENTIALS (wrong username/password)
    │   └── "Invalid username or password."
    │
    ├── User not found (MySQL fallback mode)
    │   └── "User not found"
    │
    └── Incorrect password (MySQL fallback mode)
        └── "Incorrect password"
```

### 9.2. API Request Error Chain

```
Renderer component
    │ call window.electronAPI.db.* or auth.*
    │
    ▼
preload.js (ipcRenderer.invoke)
    │
    ▼
ipc-handlers.js
    │ try/catch around all handlers
    │
    ├── MySQL error → propagate to renderer
    │
    └── API error → api-client.js handles:
        │
        ├── 429 → error.code = 'RATE_LIMITED'
        ├── 401 → auto-retry refresh → SESSION_EXPIRED if fails
        ├── timeout → error.code = 'TIMEOUT'
        └── network → error.code = 'NETWORK_ERROR'
```

### 9.3. Graceful Degradation

```
┌─────────────────────────────────────────────────┐
│            Failure Scenarios                     │
│                                                  │
│  API server down + SSO enabled:                 │
│  ├── Startup: trust localStorage (still works)  │
│  ├── Login: throws NETWORK_ERROR                │
│  └── Token refresh: fails, user may be logged   │
│      out after 30 min                           │
│                                                  │
│  API server down + SSO disabled:                │
│  ├── All auth via MySQL (no API dependency)     │
│  └── App works 100% normally                    │
│                                                  │
│  MySQL down:                                     │
│  ├── Login fails (both modes)                   │
│  └── All CRUD operations fail                   │
│                                                  │
│  API logout fails:                               │
│  └── Local state cleared anyway (user logs out) │
│      Server token remains (expires in 7 days)   │
└─────────────────────────────────────────────────┘
```

---

## 10. Auto-Update Flow

```
App starts (production only, app.isPackaged)
    │
    ▼
autoUpdater.checkForUpdatesAndNotify()
    │
    ├── No update available → nothing happens
    │
    └── Update available
        │
        ▼
    ┌─────────────────────┐
    │ 'update-available'  │  mainWindow.webContents.send()
    │ event → renderer    │  → UI notification shown
    └────────┬────────────┘
             │
             ▼ (auto-download)
    ┌─────────────────────┐
    │ 'update-downloaded' │  mainWindow.webContents.send()
    │ event → renderer    │  → "Install now?" prompt
    └────────┬────────────┘
             │
             │ User clicks "Install"
             ▼
    ┌─────────────────────┐
    │ install-update IPC  │  autoUpdater.quitAndInstall()
    │ → quit & restart    │
    └─────────────────────┘
```

---

## 11. File Map

```
PressifyReprintApp/
├── .env                                  # DB + API + SSO config
├── src/
│   ├── main/
│   │   ├── main.js                       # Entry: pool, API init, window, IPC core
│   │   ├── database.js                   # MySQL pool + t() prefix helper
│   │   ├── ipc-handlers.js              # ALL IPC handlers (auth:* + db:*)
│   │   ├── api-client.js                # HTTP client → Laravel API (Sanctum)
│   │   ├── token-store.js               # Encrypted token storage (electron-store + safeStorage)
│   │   ├── preload.js                    # Context bridge: window.electronAPI
│   │   └── logger.js                     # File logger (userData/logs/)
│   └── renderer/
│       ├── index.jsx                     # React entry
│       ├── App.jsx                       # Router + PrivateRoute guards
│       ├── contexts/
│       │   └── AuthContext.jsx           # Auth state, login/logout, token refresh timer
│       └── components/
│           ├── Login.jsx                 # Login form UI
│           ├── Layout.jsx                # Sidebar + topbar
│           ├── Dashboard.jsx             # Admin stats + charts
│           ├── ReprintList.jsx           # Reprint CRUD table
│           ├── ReprintForm.jsx           # Reprint add/edit modal
│           ├── ProductList.jsx           # Product management
│           ├── ProductImport.jsx         # CSV import
│           ├── Permission.jsx            # Users/reasons/order-types admin
│           └── Timeline.jsx              # Activity log per reprint
├── api/                                   # Laravel backend files (drop into Laravel project)
│   ├── app/Models/
│   │   ├── User.php                      # HasApiTokens + role + toApiResponse()
│   │   ├── Role.php                      # Role model
│   │   └── SsoCode.php                   # SSO code model + validation
│   ├── app/Http/Controllers/Api/
│   │   └── AuthController.php            # login, logout, refresh, me, validate, sso-code, sso-exchange
│   ├── routes/
│   │   ├── api.php                       # API routes (auth:sanctum middleware)
│   │   └── web.php                       # SSO callback web route
│   ├── database/migrations/
│   │   ├── create_personal_access_tokens_table.php
│   │   └── create_sso_codes_table.php
│   └── config/
│       └── sanctum.php                   # Token expiration: 7 days
├── migration.sql                          # Electron app table creation
├── API_DOCUMENTATION.md                   # API endpoint reference
└── SYSTEM_FLOW.md                         # This file
```
