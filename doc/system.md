# Pressify Reprint — Tai Lieu He Thong

## 1. Tong Quan

Pressify Reprint la ung dung desktop quan ly viec reprint (in lai) don hang. Ung dung duoc xay dung bang **Electron + React**, giao tiep voi **Laravel Vanguard API** qua REST API.

---

## 2. Cong Nghe Su Dung

### 2.1 Desktop App (Electron)

| Cong nghe | Phien ban | Vai tro |
|-----------|-----------|---------|
| **Electron** | ^33.3.1 | Framework tao ung dung desktop tu web (Chromium + Node.js) |
| **Electron Forge** | ^7.6.0 | Tool build, package va publish ung dung Electron |
| **electron-store** | ^8.2.0 | Luu tru settings va token cuc bo (file JSON ma hoa) |
| **update-electron-app** | ^3.1.2 | Tu dong cap nhat app tu GitHub Releases |
| **electron-squirrel-startup** | ^1.0.1 | Xu ly installer events tren Windows (Squirrel) |

### 2.2 Frontend (Renderer Process)

| Cong nghe | Phien ban | Vai tro |
|-----------|-----------|---------|
| **React** | ^18.3.1 | Thu vien UI, quan ly giao dien theo component |
| **React DOM** | ^18.3.1 | Render React components len DOM |
| **React Router DOM** | ^6.28.1 | Dinh tuyen trang (HashRouter cho Electron) |
| **Bootstrap** | ^5.3.3 | CSS framework, giao dien responsive |
| **Chart.js** | ^4.4.7 | Thu vien ve bieu do (Dashboard) |
| **react-chartjs-2** | ^5.3.0 | React wrapper cho Chart.js |
| **PapaParse** | ^5.4.1 | Doc va parse file CSV (import san pham) |

### 2.3 Build Tools

| Cong nghe | Vai tro |
|-----------|---------|
| **Webpack** | Bundle source code (main + renderer rieng biet) |
| **Babel** | Transpile JSX va ES6+ thanh JavaScript tuong thich |
| **@babel/preset-react** | Xu ly cu phap JSX |
| **@babel/preset-env** | Xu ly cu phap ES6/ES7+ |
| **css-loader + style-loader** | Load va inject CSS vao app |
| **node-loader** | Load native Node.js modules (.node) |

### 2.4 Backend (Laravel)

| Cong nghe | Vai tro |
|-----------|---------|
| **Laravel** | PHP framework, xu ly API va business logic |
| **Laravel Sanctum** | Token-based authentication cho API |
| **MySQL** | Co so du lieu quan he |

### 2.5 CI/CD

| Cong nghe | Vai tro |
|-----------|---------|
| **GitHub Actions** | Tu dong build khi push tag `v*` |
| **maker-squirrel** | Tao installer .exe cho Windows |
| **maker-zip** | Tao file .zip cho macOS |
| **maker-deb** | Tao package .deb cho Linux |
| **publisher-github** | Upload artifacts len GitHub Releases |

---

## 3. Nguyen Ly Hoat Dong

### 3.1 Kien Truc Electron (Multi-Process)

Electron chay 2 process rieng biet, giao tiep qua IPC (Inter-Process Communication):

```
┌─────────────────────────────────────────────────────┐
│                   MAIN PROCESS                       │
│                  (src/main/main.js)                   │
│                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ API Client   │  │ Token Store  │  │   Logger    │ │
│  │ (api-client) │  │ (token-store)│  │  (logger)   │ │
│  └──────┬──────┘  └──────────────┘  └─────────────┘ │
│         │                                             │
│  ┌──────┴──────────────────┐  ┌───────────────────┐  │
│  │    IPC Handlers         │  │   Auto Updater    │  │
│  │   (ipc-handlers.js)     │  │(update-electron)  │  │
│  └──────┬──────────────────┘  └───────────────────┘  │
│         │ IPC Bridge                                  │
├─────────┼─────────────────────────────────────────────┤
│         │    PRELOAD (src/main/preload.js)            │
│         │    contextBridge → window.electronAPI       │
├─────────┼─────────────────────────────────────────────┤
│         │                                             │
│  ┌──────┴──────────────────────────────────────────┐ │
│  │              RENDERER PROCESS                    │ │
│  │              (src/renderer/)                     │ │
│  │                                                  │ │
│  │  React App → Components → window.electronAPI.*   │ │
│  │                                                  │ │
│  │  AuthContext ←→ localStorage (session)           │ │
│  └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
          │
          │ HTTPS (Bearer Token)
          ▼
┌─────────────────────────┐
│   Laravel Vanguard API  │
│   (hub.pressify.us)     │
│                         │
│   MySQL Database        │
└─────────────────────────┘
```

### 3.2 Luong Du Lieu (Data Flow)

Moi thao tac du lieu di theo luong:

```
User click UI
    ↓
React Component goi window.electronAPI.db.xxx()
    ↓
Preload chuyen thanh ipcRenderer.invoke('db:xxx')
    ↓
Main Process nhan IPC, goi api-client.js
    ↓
api-client.js gui HTTP request (GET/POST/PUT/DELETE)
  → Header: Authorization: Bearer <token>
  → Content-Type: application/json
    ↓
Laravel API xu ly, tra ve JSON
    ↓
Main Process tra ket qua ve Renderer qua IPC
    ↓
React Component cap nhat state → re-render UI
```

### 3.3 Xac Thuc (Authentication Flow)

```
1. DANG NHAP:
   User nhap username + password
       ↓
   POST /api/login {username, password, device_name: "electron-app"}
       ↓
   Laravel tra ve {token, user}
       ↓
   Main Process: token-store luu token (ma hoa bang safeStorage)
   Renderer: localStorage luu user data (pressify_user)
       ↓
   Bat dau timer refresh moi 30 phut

2. MOI REQUEST:
   api-client.js tu dong dinh kem header:
   Authorization: Bearer <token>

3. TOKEN HET HAN (401):
   api-client.js nhan 401 → throw SESSION_EXPIRED
       ↓
   Renderer xoa session → redirect ve /login

4. DANG XUAT:
   POST /api/logout (xoa token phia server)
       ↓
   token-store.clearAll() (xoa token cuc bo)
   localStorage xoa pressify_user
```

### 3.4 Bao Mat (Security)

| Co che | Mo ta |
|--------|-------|
| **contextIsolation = true** | Renderer khong truy cap truc tiep Node.js, chi qua preload bridge |
| **nodeIntegration = false** | Tat Node.js trong renderer, ngan code doc/ghi file tu UI |
| **safeStorage** | Ma hoa token bang OS-level encryption (Keychain/DPAPI/libsecret) |
| **electron-store encryption** | Lop ma hoa thu 2 cho file luu tru auth |
| **HTTPS enforcement** | api-client.js tu dong chuyen HTTP → HTTPS (tru localhost) |
| **Rate limiting** | API tra ve 429 khi qua nhieu request, client xu ly Retry-After |
| **Sanctum token** | Moi phien dang nhap co token rieng, xoa khi logout |

### 3.5 Cau Hinh (Settings)

Settings duoc luu bang `electron-store` (store name: `pressify-settings`), **KHONG** dung file `.env`.

| Setting | Mac dinh | Mo ta |
|---------|----------|-------|
| `apiBaseUrl` | `https://hub.pressify.us` | Dia chi API server |
| `apiTimeout` | `10000` (10 giay) | Thoi gian cho toi da cho moi request |

- Admin co the thay doi qua trang Settings trong app
- Nut "Test Connection" kiem tra ket noi toi server truoc khi luu
- "Reset" tra ve gia tri mac dinh

### 3.6 Auto Update

```
App khoi dong (production)
    ↓
update-electron-app kiem tra GitHub Releases moi 10 phut
    ↓
Co phien ban moi? → Download ngam
    ↓
Hien thong bao cho user
    ↓
User click "Install Update" → Restart va cap nhat
```

---

## 4. Chuc Nang Chi Tiet

### 4.1 Trang Reprints (Tat ca user)
- **Bang reprint** voi inline edit (click vao cell de sua truc tiep)
- **Checkbox select** cho phep chon nhieu reprint
- **"Complete Selected"** doi status sang completed va tu dong dien Finished Date (gio America/Chicago)
- **Khi doi Status → Completed**: tu dong dien Finished Date = now() theo gio Chicago
- **Loc theo status**: Not Yet / Processing / Completed / Printed
- **Tim kiem** theo Order ID, note, support name
- **Nhom theo ngay** (date tabs) — ngay theo gio America/Chicago
- **Paste URL** tu qr.pressify.us hoac shirt.pressify.us → tu dong extract Order ID
- **Timeline log** ghi lai moi thay doi cua tung reprint
- **Tu dong tao reprint moi** khi vao trang (neu khong co reprint nao trong)
- **Dropdown auto-open** khi click vao cell select (showPicker)

### 4.2 Thong Tin Reprint

| Field | Mo Ta |
|-------|-------|
| Support Name | Nguoi tao reprint (role: support) |
| Order ID | Ma don hang |
| Li do Reprint | Ly do can reprint (reason_reprint) |
| Note | Ghi chu cho team gangsheet |
| Loai Ao | San pham (product_reprint) |
| Size | Kich co (size_reprint) |
| Color | Mau sac (color_reprint) |
| Hang Ao | Thuong hieu ao |
| Ly Do Loi | Ly do loi xay ra |
| Ai Lam Sai | Nguoi gay loi (user_reprint type=1) |
| Note (Error) | Nguoi lien quan (user_reprint type=2) |
| Status (Gangsheet) | Trang thai: not_yet → processing → completed → printed |
| Finished Date | Ngay hoan thanh (tu dong khi completed) |

### 4.3 Trang Dashboard (Admin)
- Thong ke reprint theo status
- Bieu do theo reason, support user (Chart.js)

### 4.4 Trang Products (Admin)
- CRUD Product (Loai Ao), Color, Size — 3 danh sach doc lap
- Them nhanh tu dropdown "+ Add New" khi dang edit reprint

### 4.5 Import CSV (Admin)
- Import san pham tu file CSV (PapaParse)
- Cot bat buoc: `product_name`, `color`, `size`

### 4.6 Trang Permission (Admin)
- Quan ly user: tao / sua / xoa, gan role
- Quan ly Reprint Reasons
- Quan ly Order Types

### 4.7 Trang Settings (Admin)
- Cau hinh API URL va timeout
- Test connection truoc khi luu
- Reset ve mac dinh

---

## 5. Reprint Status Flow

```
not_yet ──→ processing ──→ completed ──→ printed
                              │
                              └── tu dong dien finished_date
                                  (America/Chicago timezone)
```

---

## 6. Phan Quyen (11 Roles)

| Role | Dashboard | Reprints | Products | Permission | Settings |
|------|-----------|----------|----------|------------|----------|
| **Admin** | Co | Co | Co | Co | Co |
| Support | Khong | Co | Khong | Khong | Khong |
| Designer | Khong | Co | Khong | Khong | Khong |
| Printer | Khong | Co | Khong | Khong | Khong |
| Presser | Khong | Co | Khong | Khong | Khong |
| Cuter | Khong | Co | Khong | Khong | Khong |
| Picker | Khong | Co | Khong | Khong | Khong |
| User | Khong | Co | Khong | Khong | Khong |
| Seller | Khong | Co | Khong | Khong | Khong |
| Supplier | Khong | Co | Khong | Khong | Khong |
| Staff | Khong | Co | Khong | Khong | Khong |

Tat ca role deu truy cap duoc trang Reprints. Chi Admin moi truy cap Dashboard, Products, Permission, Settings.

---

## 7. Cau Truc File

```
src/
├── main/                          # Main Process (Node.js)
│   ├── main.js                    # Entry point: tao window, init API, dang ky IPC
│   ├── preload.js                 # Bridge: expose window.electronAPI cho renderer
│   ├── api-client.js              # HTTP client goi Laravel API (GET/POST/PUT/DELETE)
│   ├── ipc-handlers.js            # Dang ky tat ca IPC handlers (db:*, auth:*, settings:*)
│   ├── token-store.js             # Luu/doc/xoa token (electron-store + safeStorage)
│   └── logger.js                  # Ghi log ra file (userData/logs/app-YYYY-MM-DD.log)
│
└── renderer/                      # Renderer Process (React)
    ├── index.html                 # HTML template
    ├── index.jsx                  # React entry point
    ├── App.jsx                    # Router + PrivateRoute (role guard)
    ├── contexts/
    │   └── AuthContext.jsx        # Auth state, login/logout, auto-refresh token
    └── components/
        ├── Layout.jsx             # Sidebar + topbar
        ├── Login.jsx              # Trang dang nhap
        ├── Dashboard.jsx          # Thong ke + bieu do
        ├── ReprintList.jsx        # Bang reprint (inline edit, checkbox, filter)
        ├── ReprintForm.jsx        # Modal them/sua reprint
        ├── ProductList.jsx        # Quan ly Product/Color/Size
        ├── ProductImport.jsx      # Import CSV
        ├── Permission.jsx         # Quan ly user/reason/order-type
        ├── Settings.jsx           # Cau hinh API
        └── Timeline.jsx           # Log hoat dong cua reprint
```

---

## 8. API Endpoints

Tat ca resource theo pattern chung: `getAll` → GET, `create` → POST, `update` → PUT, `delete` → DELETE.

| Resource | API Path |
|----------|----------|
| Auth Login | `POST /api/login` |
| Auth Logout | `POST /api/logout` |
| Auth Me | `GET /api/me` |
| Reprints | `/api/reprints` |
| Users | `/api/reprint-users` |
| Roles | `/api/reprint-roles` (read-only) |
| Product Reprints | `/api/product-reprints` |
| Color Reprints | `/api/color-reprints` |
| Size Reprints | `/api/size-reprints` |
| User Reprints | `/api/user-reprints` |
| Reasons | `/api/reasons` |
| Order Types | `/api/order-types` |
| Timelines | `GET /api/timelines/{reprintId}`, `POST /api/timelines` |

### Response Format
- **List (getAll)**: Object key theo ID — `{"1": {...}, "2": {...}}`
- **Timelines**: Array (sap xep theo id DESC)
- **Create**: `{id: "..."}` (string)
- **Update/Delete**: `{success: true}`
- **Login**: `{token, user: {uid, username, name, role, role_id}}`

---

## 9. Database Tables

| Table | Mo ta |
|-------|-------|
| `users` | Thong tin nguoi dung (tu Vanguard) |
| `roles` | Vai tro nguoi dung (tu Vanguard) |
| `reprints` | Ban ghi reprint chinh |
| `product_reprint` | Danh sach san pham (loai ao) |
| `color_reprint` | Danh sach mau sac |
| `size_reprint` | Danh sach kich co |
| `reason_reprints` | Danh sach ly do reprint |
| `order_types` | Danh sach loai don hang |
| `reprint_timelines` | Log hoat dong cua tung reprint |
| `personal_access_tokens` | Token Sanctum |

---

## 10. Build & Deploy

```
1. Dev:     npm start                    → Chay app voi hot reload
2. Build:   npm run make                 → Tao installer cho OS hien tai
3. Release: git tag v1.x.x && git push --tags
             → GitHub Actions tu dong build 3 OS
             → Upload len GitHub Releases
4. Update:  App tu dong kiem tra va cap nhat tu GitHub Releases
```
