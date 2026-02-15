# Pressify Reprint — Laravel API Documentation

API backend cho Electron desktop app, sử dụng **Laravel Sanctum** (token-based authentication).
Desktop app và Laravel API **dùng chung 1 MySQL database** (`pressify`).

---

## Table of Contents

1. [Requirements](#1-requirements)
2. [Setup Guide — Từng bước](#2-setup-guide--từng-bước)
3. [Database Schema](#3-database-schema)
4. [API Endpoints — Chi tiết từng endpoint](#4-api-endpoints--chi-tiết-từng-endpoint)
5. [Desktop App Data Contract](#5-desktop-app-data-contract)
6. [Error Handling](#6-error-handling)
7. [Testing với cURL — Full flow](#7-testing-với-curl--full-flow)
8. [SSO Flow](#8-sso-flow)
9. [Laravel PHP Source Files](#9-laravel-php-source-files)
10. [Checklist triển khai](#10-checklist-triển-khai)

---

## 1. Requirements

| Component | Version |
|-----------|---------|
| PHP | >= 8.1 |
| Laravel | >= 10.x |
| Laravel Sanctum | >= 3.x |
| MySQL | >= 5.7 |
| Composer | >= 2.x |

---

## 2. Setup Guide — Từng bước

### Bước 1: Tạo Laravel project

```bash
composer create-project laravel/laravel pressify-api
cd pressify-api
```

### Bước 2: Cài Laravel Sanctum

```bash
composer require laravel/sanctum
```

### Bước 3: Cấu hình `.env`

```ini
APP_NAME=PressifyAPI
APP_URL=http://127.0.0.1:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=pressify
DB_USERNAME=root
DB_PASSWORD=
DB_PREFIX=

SANCTUM_TOKEN_EXPIRATION=10080
```

> **QUAN TRỌNG:** Database `pressify` phải là **cùng database** mà Electron desktop app đang dùng.
> Cả hai chia sẻ chung bảng `users` và `roles`. Electron app quản lý users qua MySQL trực tiếp,
> Laravel chỉ xử lý authentication (login → cấp token).

### Bước 4: Copy PHP files vào Laravel project

Từ thư mục `api/` trong repo Electron app, copy vào Laravel project:

```
COPY FROM                                    →  COPY TO (in Laravel project)
─────────────────────────────────────────────────────────────────────────────
api/app/Models/User.php                      →  app/Models/User.php (REPLACE)
api/app/Models/Role.php                      →  app/Models/Role.php (NEW)
api/app/Models/SsoCode.php                   →  app/Models/SsoCode.php (NEW)
api/app/Http/Controllers/Api/AuthController.php
                                             →  app/Http/Controllers/Api/AuthController.php (NEW)
api/routes/api.php                           →  routes/api.php (REPLACE)
api/routes/web.php                           →  routes/web.php (MERGE vào cuối file có sẵn)
api/database/migrations/*                    →  database/migrations/ (COPY 2 files)
api/config/sanctum.php                       →  config/sanctum.php (REPLACE)
```

### Bước 5: Chạy migrations

```bash
php artisan migrate
```

Tạo 2 bảng mới:
- `personal_access_tokens` — Sanctum token storage
- `sso_codes` — SSO one-time code storage

> Bảng `users` và `roles` đã tồn tại từ Electron app — KHÔNG tạo lại.

### Bước 6: Tạo SSO error view (optional)

```bash
mkdir -p resources/views/errors
```

Tạo file `resources/views/errors/sso.blade.php`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>SSO Error</title>
    <style>
        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
        .card { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
        h1 { color: #dc3545; margin-bottom: 10px; }
        p { color: #666; }
    </style>
</head>
<body>
    <div class="card">
        <h1>SSO Login Failed</h1>
        <p>{{ $message }}</p>
        <p style="margin-top: 20px;"><a href="/">Back to Home</a></p>
    </div>
</body>
</html>
```

### Bước 7: Khởi động

```bash
php artisan serve
```

Server chạy tại `http://127.0.0.1:8000`.

### Bước 8: Cấu hình Electron app kết nối

Trong file `.env` của Electron app:

```ini
API_BASE_URL=http://127.0.0.1:8000
API_TIMEOUT=10000
SSO_ENABLED=true
```

Production: đổi `API_BASE_URL` thành domain thực (HTTPS required).

---

## 3. Database Schema

### 3.1. Bảng có sẵn (shared với Electron app — KHÔNG tạo mới)

#### `roles`

| Column       | Type         | Note                |
|--------------|--------------|---------------------|
| id           | INT PK AI    |                     |
| name         | VARCHAR(255) | Tên role (lowercase)|
| display_name | VARCHAR(255) | Tên hiển thị        |

**7 roles mặc định:** `admin`, `support`, `designer`, `printer`, `cuter`, `picker`, `processer`

#### `users`

| Column     | Type         | Note                           |
|------------|--------------|--------------------------------|
| id         | INT PK AI    |                                |
| email      | VARCHAR(255) | NOT NULL                       |
| username   | VARCHAR(255) | NOT NULL, UNIQUE               |
| password   | VARCHAR(255) | bcrypt hash (10 salt rounds)   |
| first_name | VARCHAR(255) |                                |
| last_name  | VARCHAR(255) |                                |
| phone      | VARCHAR(20)  |                                |
| role_id    | INT          | FK → roles.id                  |
| status     | VARCHAR(50)  | `'Active'` hoặc `'Banned'`    |
| created_at | TIMESTAMP    |                                |
| updated_at | TIMESTAMP    |                                |

> **Default admin seed:** Electron app tự tạo user `admin` / `admin123` nếu bảng users rỗng.
> Password hash bằng bcryptjs (10 salt rounds) — compatible với PHP `Hash::check()`.

### 3.2. Bảng mới (tạo bởi Laravel migrations)

#### `personal_access_tokens` (Sanctum)

| Column         | Type             | Note                         |
|----------------|------------------|------------------------------|
| id             | BIGINT PK AI     |                              |
| tokenable_type | VARCHAR(255)     | `'App\Models\User'`         |
| tokenable_id   | BIGINT UNSIGNED  | FK → users.id                |
| name           | VARCHAR(255)     | `'electron-app'`            |
| token          | VARCHAR(64)      | SHA256 hash of token, UNIQUE |
| abilities      | TEXT             | JSON array, default `['*']`  |
| last_used_at   | TIMESTAMP NULL   | Updated mỗi lần dùng token  |
| expires_at     | TIMESTAMP NULL   | Token hết hạn (7 ngày)       |
| created_at     | TIMESTAMP        |                              |
| updated_at     | TIMESTAMP        |                              |

#### `sso_codes`

| Column     | Type             | Note                          |
|------------|------------------|-------------------------------|
| id         | BIGINT PK AI     |                               |
| code       | VARCHAR(64)      | Random 64 chars, UNIQUE       |
| user_id    | BIGINT UNSIGNED  | FK → users.id (ON DELETE CASCADE) |
| expires_at | TIMESTAMP        | Hết hạn sau 5 phút            |
| used       | BOOLEAN          | Default `false`, one-time use |
| created_at | TIMESTAMP        |                               |
| updated_at | TIMESTAMP        |                               |

---

## 4. API Endpoints — Chi tiết từng endpoint

**Base URL:** `http://127.0.0.1:8000`

**Headers chung** (Desktop app gửi mọi request với):

```
Content-Type: application/json
Accept: application/json
X-Requested-With: Electron
Authorization: Bearer {token}    ← (chỉ khi có token)
```

### Tổng quan

| # | Method | Endpoint | Auth | Rate Limit | Mô tả |
|---|--------|----------|------|------------|--------|
| 1 | POST | `/api/auth/login` | No | 5/phút | Đăng nhập, trả token + user |
| 2 | POST | `/api/auth/logout` | Bearer | - | Revoke token hiện tại |
| 3 | POST | `/api/auth/refresh` | Bearer | - | Xóa token cũ, cấp token mới |
| 4 | GET | `/api/auth/me` | Bearer | - | Lấy user profile |
| 5 | POST | `/api/auth/validate` | Bearer | - | Kiểm tra token hợp lệ |
| 6 | POST | `/api/auth/sso-code` | Bearer | - | Tạo SSO code (5 phút TTL) |
| 7 | POST | `/api/auth/sso-exchange` | No | - | Đổi SSO code lấy web session |
| 8 | GET | `/sso/callback?code=xxx` | No | - | Web redirect SSO |

---

### 4.1. POST `/api/auth/login`

Đăng nhập và nhận Sanctum token.

- **Auth:** Không cần
- **Rate limit:** `throttle:5,1` (5 requests/phút)

**Request body:**

```json
{
    "username": "admin",
    "password": "admin123"
}
```

**Response 200 — Thành công:**

```json
{
    "token": "1|laravel_sanctum_abc123def456...",
    "user": {
        "uid": "1",
        "username": "admin",
        "name": "Admin User",
        "role": "admin",
        "role_id": "1",
        "id": 1,
        "email": "admin@example.com",
        "first_name": "Admin",
        "last_name": "User",
        "phone": null,
        "role_name": "admin",
        "status": "Active",
        "created_at": "2024-01-01T00:00:00.000000Z"
    }
}
```

> **Desktop app đọc:** `data.token` (lưu encrypted), `data.user` (set vào AuthContext).
> **Fields bắt buộc:** `user.uid`, `user.username`, `user.name`, `user.role`, `user.role_id`.

**Response 401 — Sai credentials:**

```json
{
    "error": "INVALID_CREDENTIALS",
    "message": "Invalid username or password."
}
```

**Response 422 — Thiếu fields:**

```json
{
    "message": "The username field is required.",
    "errors": {
        "username": ["The username field is required."]
    }
}
```

**Response 429 — Rate limited:**

```json
{
    "message": "Too Many Attempts."
}
```

Header `Retry-After: 60` (số giây cần chờ). Desktop app đọc header này.

---

### 4.2. POST `/api/auth/logout`

Revoke token hiện tại. Token bị xóa khỏi `personal_access_tokens`.

- **Auth:** Bearer token required

**Response 200:**

```json
{
    "message": "Logged out successfully."
}
```

> Desktop app: Nếu call này fail (network error), vẫn clear local token. Graceful handling.

**Response 401 — Token đã hết hạn:**

```json
{
    "message": "Unauthenticated."
}
```

---

### 4.3. POST `/api/auth/refresh`

Token rotation: xóa token cũ, cấp token mới (7-day expiry).

- **Auth:** Bearer token required (token cũ)

**Response 200:**

```json
{
    "token": "2|laravel_sanctum_newtoken789...",
    "user": {
        "uid": "1",
        "username": "admin",
        "name": "Admin User",
        "role": "admin",
        "role_id": "1",
        "id": 1,
        "email": "admin@example.com",
        "first_name": "Admin",
        "last_name": "User",
        "phone": null,
        "role_name": "admin",
        "status": "Active",
        "created_at": "2024-01-01T00:00:00.000000Z"
    }
}
```

> **Desktop app đọc:** `data.token` (lưu thay token cũ).
> **Khi nào gọi:** Tự động mỗi 30 phút (`REFRESH_INTERVAL` trong AuthContext),
> và khi nhận 401 response (auto-retry mechanism trong api-client.js).

---

### 4.4. GET `/api/auth/me`

Lấy thông tin user hiện tại.

- **Auth:** Bearer token required

**Response 200:**

```json
{
    "user": {
        "uid": "1",
        "username": "admin",
        "name": "Admin User",
        "role": "admin",
        "role_id": "1",
        "id": 1,
        "email": "admin@example.com",
        "first_name": "Admin",
        "last_name": "User",
        "phone": null,
        "role_name": "admin",
        "status": "Active",
        "created_at": "2024-01-01T00:00:00.000000Z"
    }
}
```

---

### 4.5. POST `/api/auth/validate`

Kiểm tra token còn hợp lệ hay không. Desktop app gọi khi startup để restore session.

- **Auth:** Bearer token required

**Response 200 — Token hợp lệ:**

```json
{
    "valid": true,
    "user": {
        "uid": "1",
        "username": "admin",
        "name": "Admin User",
        "role": "admin",
        "role_id": "1",
        "id": 1,
        "email": "admin@example.com",
        "first_name": "Admin",
        "last_name": "User",
        "phone": null,
        "role_name": "admin",
        "status": "Active",
        "created_at": "2024-01-01T00:00:00.000000Z"
    }
}
```

> **Desktop app đọc:** `validation.valid` (boolean). Nếu `true` → restore session + start refresh timer.

**Response 401 — Token hết hạn/invalid:**

```json
{
    "message": "Unauthenticated."
}
```

> Sanctum middleware trả 401 trước khi vào controller. Desktop nhận 401 → token invalid → clear session → show login.

---

### 4.6. POST `/api/auth/sso-code`

Tạo mã SSO dùng một lần (one-time code, 5 phút TTL).

- **Auth:** Bearer token required

**Response 200:**

```json
{
    "code": "aB3xY7kLm9pQ2wE4rT5yU8iO0pA1sD3fG6hJ7kL...",
    "expires_at": "2024-01-01T12:05:00+00:00"
}
```

> **Desktop app đọc:** `{ code }` (destructure). Rồi mở browser: `{API_BASE_URL}/sso/callback?code={code}`
> Code dài 64 ký tự, `expires_at` là informational.

---

### 4.7. POST `/api/auth/sso-exchange`

Đổi SSO code lấy web session (cookie-based). **Không cần Bearer token** — code là credential.

- **Auth:** Không cần

**Request body:**

```json
{
    "code": "aB3xY7kLm9pQ2wE4rT5yU8iO0pA1sD3fG6hJ7kL..."
}
```

**Response 200:**

```json
{
    "message": "SSO login successful.",
    "user": {
        "uid": "1",
        "username": "admin",
        "name": "Admin User",
        "role": "admin",
        "role_id": "1"
    }
}
```

**Response 401 — Code invalid/expired:**

```json
{
    "error": "INVALID_CODE",
    "message": "SSO code is invalid or expired."
}
```

**Response 403 — Account disabled:**

```json
{
    "error": "ACCOUNT_DISABLED",
    "message": "User account is disabled."
}
```

---

### 4.8. GET `/sso/callback?code=xxx`

Web route — browser mở URL này từ Electron app. Tự exchange code → tạo web session → redirect.

- **Auth:** Không cần (SSO code trong query param)
- **Success:** Redirect 302 → `/dashboard`
- **Error:** Render `errors/sso.blade.php` với message

> Desktop app gọi `shell.openExternal(url)` → browser opens → route này tự xử lý.

---

## 5. Desktop App Data Contract

### 5.1. User Object — Format bắt buộc

Desktop app (`AuthContext.jsx`) lưu `result.user` trực tiếp vào state và localStorage.
Components đọc các fields sau:

| Field | Type | Dùng ở đâu | Mô tả |
|-------|------|-------------|--------|
| `uid` | `string` | ReprintList, ReprintForm, Permission | ID user (dùng cho timeline user_id, prevent self-delete) |
| `username` | `string` | AuthContext | Tên đăng nhập |
| `name` | `string` | Layout (topbar), ReprintList, ReprintForm | Tên hiển thị (full name) |
| `role` | `string` | App.jsx (routing), Layout (badge) | Tên role lowercase: `'admin'`, `'support'`, `'designer'`, `'printer'`, `'cuter'`, `'picker'`, `'processer'` |
| `role_id` | `string` | AuthContext | ID role (as string) |

**QUAN TRỌNG:**
- `uid` KHÔNG phải `id` — desktop dùng field tên `uid`
- `name` là full name (ghép `first_name` + `last_name`), KHÔNG phải separate fields
- `role` phải lowercase
- `role_id` phải là **string** (không phải number)

### 5.2. Login Response — Format bắt buộc

```javascript
// api-client.js line 119-124:
const data = await request('POST', '/api/auth/login', { username, password });
if (data.token) {
    tokenStore.storeToken(data.token);     // Lưu token encrypted
    tokenStore.storeUserData(data.user);    // Lưu user object
}
return data;

// ipc-handlers.js line 338:
return { ...data, sso: true };
// → { token, user: {...}, sso: true }

// AuthContext.jsx line 98:
const userData = result.user;
setCurrentUser(userData);
```

### 5.3. Refresh Response — Format bắt buộc

```javascript
// api-client.js line 137-142:
const data = await request('POST', '/api/auth/refresh');
if (data.token) {
    tokenStore.storeToken(data.token);  // Chỉ đọc data.token
}
return data;
```

> Laravel PHẢI trả `{ token: "..." }`. Field `user` là optional nhưng recommended.

### 5.4. Validate Response — Format bắt buộc

```javascript
// AuthContext.jsx line 65-66:
const validation = await window.electronAPI.auth.validate();
if (validation.valid) { /* restore session */ }
```

> Laravel PHẢI trả `{ valid: true }`. Nếu token invalid, Sanctum trả 401 trước.

### 5.5. SSO Code Response — Format bắt buộc

```javascript
// ipc-handlers.js line 396:
const { code } = await apiClient.generateSsoCode();
const ssoUrl = `${baseUrl}/sso/callback?code=${encodeURIComponent(code)}`;
```

> Laravel PHẢI trả `{ code: "string(64)" }`. Desktop chỉ đọc field `code`.

### 5.6. Token format

Sanctum token format: `{id}|{plaintext}` (e.g., `1|abc123...`)
- Desktop app lưu toàn bộ string này làm Bearer token
- Desktop gửi lại trong header: `Authorization: Bearer 1|abc123...`
- Laravel Sanctum tự parse `{id}` để lookup, verify bằng SHA256 hash

---

## 6. Error Handling

### 6.1. HTTP Status Codes

| Code | Ý nghĩa | Desktop app xử lý |
|------|---------|-------------------|
| 200 | Thành công | Parse JSON response |
| 401 | Chưa xác thực / Token hết hạn | Auto-refresh token 1 lần, nếu fail → `SESSION_EXPIRED` |
| 403 | Tài khoản bị banned | Show error message |
| 422 | Validation error | Show `data.message` |
| 429 | Rate limited | Show message + đọc `Retry-After` header |
| 500 | Server error | Show generic error |

### 6.2. Application Error Codes

| Error Code | Endpoint | HTTP | Ý nghĩa |
|-----------|----------|------|---------|
| `INVALID_CREDENTIALS` | `/auth/login` | 401 | Sai username hoặc password |
| `INVALID_CODE` | `/auth/sso-exchange` | 401 | SSO code không hợp lệ hoặc đã hết hạn |
| `ACCOUNT_DISABLED` | `/auth/sso-exchange` | 403 | Tài khoản bị Banned |

### 6.3. Desktop App Error Codes (internal)

Desktop app tự tạo các error code này khi xử lý response:

| Error Code | Trigger | User Message |
|-----------|---------|-------------|
| `RATE_LIMITED` | HTTP 429 | "Rate limited. Try again in {n} seconds." |
| `SESSION_EXPIRED` | HTTP 401 + refresh failed | → Logout user, redirect to login |
| `TIMEOUT` | Request > `API_TIMEOUT` ms | "Server is not responding. Please try again later." |
| `NETWORK_ERROR` | Cannot connect | "Cannot connect to server. Please check your network connection." |

### 6.4. Laravel Error Response Format

Desktop app parse error response như sau:

```javascript
// api-client.js line 81-93:
const text = await response.text();
let data = JSON.parse(text);  // fallback: { message: text }

if (!response.ok) {
    const error = new Error(data.message || `Request failed with status ${status}`);
    error.status = response.status;
    error.data = data;
    throw error;
}
```

→ Laravel error response **PHẢI có** field `message`:

```json
{
    "message": "Human-readable error description",
    "error": "ERROR_CODE"
}
```

---

## 7. Testing với cURL — Full flow

### Test 1: Login

```bash
# Đăng nhập
curl -s -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Response: {"token":"1|abc...","user":{"uid":"1","username":"admin","name":"Admin",...}}
# → Lưu lại giá trị "token" để dùng cho các test tiếp theo
```

### Test 2: Validate Token

```bash
TOKEN="1|abc..."  # thay bằng token thật

curl -s -X POST http://127.0.0.1:8000/api/auth/validate \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $TOKEN"

# Response: {"valid":true,"user":{...}}
```

### Test 3: Get Profile

```bash
curl -s -X GET http://127.0.0.1:8000/api/auth/me \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $TOKEN"

# Response: {"user":{"uid":"1","username":"admin","name":"Admin",...}}
```

### Test 4: Refresh Token

```bash
curl -s -X POST http://127.0.0.1:8000/api/auth/refresh \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $TOKEN"

# Response: {"token":"2|new...","user":{...}}
# → Token cũ ($TOKEN) đã bị xóa, dùng token mới cho các request tiếp
```

### Test 5: Generate SSO Code

```bash
NEW_TOKEN="2|new..."  # token mới từ refresh

curl -s -X POST http://127.0.0.1:8000/api/auth/sso-code \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $NEW_TOKEN"

# Response: {"code":"aB3xY7kLm9pQ...","expires_at":"2024-01-01T12:05:00+00:00"}
```

### Test 6: Exchange SSO Code

```bash
SSO_CODE="aB3xY7kLm9pQ..."  # code từ test 5

curl -s -X POST http://127.0.0.1:8000/api/auth/sso-exchange \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{\"code\": \"$SSO_CODE\"}"

# Response: {"message":"SSO login successful.","user":{...}}
```

### Test 7: SSO Callback (mở trong browser)

```
http://127.0.0.1:8000/sso/callback?code=aB3xY7kLm9pQ...
```

> Lưu ý: SSO code chỉ dùng được **1 lần**. Nếu đã dùng ở test 6, cần tạo code mới.

### Test 8: Logout

```bash
curl -s -X POST http://127.0.0.1:8000/api/auth/logout \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $NEW_TOKEN"

# Response: {"message":"Logged out successfully."}
```

### Test 9: Verify token đã bị revoke

```bash
curl -s -X GET http://127.0.0.1:8000/api/auth/me \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $NEW_TOKEN"

# Response: {"message":"Unauthenticated."} (401)
```

### Test 10: Rate limiting

```bash
# Gửi 6 request login liên tục (quá giới hạn 5/phút)
for i in 1 2 3 4 5 6; do
  echo "--- Request $i ---"
  curl -s -X POST http://127.0.0.1:8000/api/auth/login \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -D - \
    -d '{"username": "admin", "password": "wrong"}'
  echo ""
done

# Request 6 sẽ trả 429 + header Retry-After
```

---

## 8. SSO Flow

### 8.1. Full SSO Flow (Electron → Browser)

```
Electron Desktop App                    Laravel API Server                  User's Browser
        │                                       │                                │
   ┌────┤ User đã login trong Electron app      │                                │
   │    │ (có Bearer token)                      │                                │
   │    │                                        │                                │
   │    │ User click "Open Web"                  │                                │
   │    │                                        │                                │
   │    │ 1. POST /api/auth/sso-code             │                                │
   │    │    Authorization: Bearer {token}       │                                │
   │    │───────────────────────────────────────►│                                │
   │    │                                        │                                │
   │    │                                        │ Create sso_codes record:       │
   │    │                                        │   code = random(64)            │
   │    │                                        │   user_id = authenticated user │
   │    │                                        │   expires_at = now + 5 min     │
   │    │                                        │   used = false                 │
   │    │                                        │                                │
   │    │◄───────────────────────────────────────│                                │
   │    │ { code: "aB3xY7..." }                 │                                │
   │    │                                        │                                │
   │    │ 2. Build URL:                          │                                │
   │    │    {baseUrl}/sso/callback?code=aB3xY7..│                                │
   │    │                                        │                                │
   │    │ 3. shell.openExternal(url)             │                                │
   │    │───────────────────────────────────────────────────────────────────────►│
   │    │                                        │                                │
   │    │                                        │ 4. GET /sso/callback?code=...  │
   │    │                                        │◄───────────────────────────────│
   │    │                                        │                                │
   │    │                                        │ 5. Lookup code in sso_codes    │
   │    │                                        │    - exists? not expired?      │
   │    │                                        │      not used?                 │
   │    │                                        │    → All YES                   │
   │    │                                        │                                │
   │    │                                        │ 6. Mark code used = true       │
   │    │                                        │    Load user                   │
   │    │                                        │    auth()->login(user)         │
   │    │                                        │    (create web session cookie) │
   │    │                                        │                                │
   │    │                                        │ 7. Redirect 302 → /dashboard   │
   │    │                                        │───────────────────────────────►│
   │    │                                        │                                │
   │    │                                        │                                │ User sees
   │    │                                        │                                │ web dashboard
   └────┘                                        │                                │ (logged in!)
```

### 8.2. Token Auto-Refresh Flow

```
AuthContext.jsx                    ipc-handlers.js                api-client.js                 Laravel
      │                                  │                              │                          │
      │ setInterval(30 min)              │                              │                          │
      │─────────────────────────────────►│                              │                          │
      │ auth.refresh()                   │                              │                          │
      │                                  │ apiClient.refresh()          │                          │
      │                                  │─────────────────────────────►│                          │
      │                                  │                              │ POST /api/auth/refresh   │
      │                                  │                              │ Bearer: old-token        │
      │                                  │                              │─────────────────────────►│
      │                                  │                              │                          │
      │                                  │                              │                          │ Delete old token
      │                                  │                              │                          │ Create new token
      │                                  │                              │                          │ (7-day expiry)
      │                                  │                              │                          │
      │                                  │                              │◄─────────────────────────│
      │                                  │                              │ { token: "new", user }   │
      │                                  │                              │                          │
      │                                  │                              │ tokenStore.storeToken()  │
      │                                  │                              │ (encrypted replace)      │
      │                                  │◄─────────────────────────────│                          │
      │◄─────────────────────────────────│                              │                          │
      │ success (silent)                 │                              │                          │
      │                                  │                              │                          │
      │ ... 30 min later → repeat ...    │                              │                          │
```

### 8.3. Auto-Retry on 401

```
api-client.js — Any API request
      │
      │ Response: 401 Unauthenticated
      │
      │ Is this login or refresh request?
      ├── YES → throw SESSION_EXPIRED (prevent infinite loop)
      └── NO →
              │
              ▼
        Try auto-refresh:
        POST /api/auth/refresh (skipRefresh: true)
              │
         ┌────┴────┐
         │         │
         ▼         ▼
       SUCCESS    FAIL
         │         │
         ▼         ▼
    Retry orig.  throw SESSION_EXPIRED
    request w/   → AuthContext clears session
    new token    → User sees Login page
```

---

## 9. Laravel PHP Source Files

### 9.1. File Structure

```
api/
├── app/
│   ├── Models/
│   │   ├── User.php              — HasApiTokens, toApiResponse() (uid/name format)
│   │   ├── Role.php              — Simple model, no timestamps
│   │   └── SsoCode.php           — isValid(), markUsed(), scopeValid(), cleanExpired()
│   └── Http/
│       └── Controllers/
│           └── Api/
│               └── AuthController.php  — 7 methods: login, logout, refresh, me,
│                                          validateToken, ssoCode, ssoExchange
├── routes/
│   ├── api.php                   — /api/auth/* routes with Sanctum middleware
│   └── web.php                   — /sso/callback web route
├── database/
│   └── migrations/
│       ├── ..._create_personal_access_tokens_table.php
│       └── ..._create_sso_codes_table.php
└── config/
    └── sanctum.php               — Token expiration: 10080 min (7 days)
```

### 9.2. Middleware Configuration

| Route | Middleware | Mô tả |
|-------|-----------|--------|
| `POST /api/auth/login` | `throttle:5,1` | Rate limit 5 requests/phút |
| `POST /api/auth/sso-exchange` | none | Public endpoint |
| `POST /api/auth/logout` | `auth:sanctum` | Requires valid Bearer token |
| `POST /api/auth/refresh` | `auth:sanctum` | Requires valid Bearer token |
| `GET /api/auth/me` | `auth:sanctum` | Requires valid Bearer token |
| `POST /api/auth/validate` | `auth:sanctum` | Requires valid Bearer token |
| `POST /api/auth/sso-code` | `auth:sanctum` | Requires valid Bearer token |
| `GET /sso/callback` | web (session) | Cookie-based auth |

### 9.3. Key Implementation Notes

**Password hashing compatibility:**
- Electron app dùng `bcryptjs` (npm) với 10 salt rounds
- Laravel dùng `Hash::check()` (PHP `password_verify()`)
- bcryptjs và PHP bcrypt **100% compatible** — cùng format `$2a$10$...` hoặc `$2b$10$...`

**Single-session enforcement:**
- Khi login, `$user->tokens()->delete()` xóa TẤT CẢ token cũ
- User chỉ có 1 active token tại 1 thời điểm
- Login trên device B sẽ invalidate token của device A

**Token expiration:**
- Code-level: `now()->addDays(7)` khi tạo token
- Config-level: `SANCTUM_TOKEN_EXPIRATION=10080` (minutes) làm safety net
- Desktop app refresh token mỗi 30 phút → token luôn "mới"

---

## 10. Checklist triển khai

### Development

- [ ] Tạo Laravel project: `composer create-project laravel/laravel pressify-api`
- [ ] Cài Sanctum: `composer require laravel/sanctum`
- [ ] Copy files từ `api/` vào Laravel project
- [ ] Cấu hình `.env` (cùng database với Electron app)
- [ ] Chạy migrations: `php artisan migrate`
- [ ] Tạo SSO error view (optional)
- [ ] Chạy server: `php artisan serve`
- [ ] Cấu hình Electron `.env`: `SSO_ENABLED=true`, `API_BASE_URL=http://127.0.0.1:8000`
- [ ] Test login bằng curl
- [ ] Test full flow từ Electron app

### Production

- [ ] Deploy Laravel trên server (Apache/Nginx + PHP-FPM)
- [ ] Cấu hình HTTPS (bắt buộc — Electron app enforce HTTPS ngoài localhost)
- [ ] Cấu hình MySQL connection (cùng server hoặc remote)
- [ ] Set `APP_ENV=production`, `APP_DEBUG=false`
- [ ] Set `SANCTUM_STATEFUL_DOMAINS` cho domain thực
- [ ] Cấu hình rate limiting phù hợp
- [ ] Update Electron `.env`: `API_BASE_URL=https://your-domain.com`
- [ ] Build và distribute Electron app
