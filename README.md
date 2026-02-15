# Pressify Reprint

Desktop application for managing print reprint orders. Built with Electron, React 18, Bootstrap 5, and MySQL.

## Prerequisites

- **Node.js** >= 18 (recommended v20)
- **MySQL** >= 5.7 (or MariaDB >= 10.3)
- **Git**

## 1. Clone & Install

```bash
git clone https://github.com/user/PressifyReprintApp.git
cd PressifyReprintApp
npm install
```

## 2. Database Setup

The app connects to an existing `pressify` MySQL database that already has `users` and `roles` tables.

### 2.1 Run Migration

Create the reprint-related tables (only run once):

```bash
mysql -u root pressify < migration.sql
```

This creates: `order_types`, `reason_reprints`, `products`, `product_variants`, `reprints`, `timelines`.

> **Note:** The `users` and `roles` tables must already exist in the database. The migration does NOT create or modify them.

### 2.2 Configure .env

Edit the `.env` file in the project root:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=pressify
DB_USERNAME=root
DB_PASSWORD=
DB_PREFIX=
```

| Variable | Description |
|---|---|
| `DB_HOST` | MySQL server host |
| `DB_PORT` | MySQL server port |
| `DB_DATABASE` | Database name |
| `DB_USERNAME` | MySQL user |
| `DB_PASSWORD` | MySQL password (leave empty if none) |
| `DB_PREFIX` | Table name prefix (leave empty if none) |

## 3. Run Development

```bash
npm start
```

The app will:
1. Connect to MySQL using `.env` config
2. Open the login window
3. Log in with an existing user from the `users` table

## 4. Database Schema

### Existing Tables (not created by this app)

**users** - id, email, username, password (bcrypt), first_name, last_name, role_id, status, ...

**roles** - id, name, display_name. Values: 1=Admin, 2=User, 3=Seller, 4=Supplier, 5=Staff, 6=Support, 7=Designer

### Tables Created by migration.sql

**reprints** - Reprint orders with support_id, order_id, link_id, reason, product variant, status, timestamps

**products** - Product catalog (name)

**product_variants** - Product sizes and colors (product_id, color, size)

**reason_reprints** - Reprint reason options (name)

**order_types** - Order type options (name)

**timelines** - Audit log per reprint with VN/US timestamps

## 5. User Roles & Access

| Role | Dashboard | Reprints | Products | Permission |
|---|---|---|---|---|
| Admin | Yes | Yes | Yes | Yes |
| Support | No | Yes | No | No |
| Designer | No | Yes | No | No |
| Other roles | No | Yes | No | No |

## 6. Build for Production

### Build Installer

```bash
npm run make
```

Output goes to `out/make/`. Builds platform-specific installer for the current OS:
- **Windows**: Squirrel installer (.exe)
- **macOS**: ZIP archive
- **Linux**: DEB package

### Package Only (no installer)

```bash
npm run package
```

Output goes to `out/`.

> **Important:** The `.env` file is bundled into the production build as an extra resource. Update it before building if targeting a different database.

## 7. Release (CI/CD)

Push a version tag to trigger GitHub Actions build:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This builds installers for Windows, macOS, and Linux, then creates a GitHub Release with all artifacts.

### Manual Publish

```bash
npm run publish
```

Requires `GITHUB_TOKEN` environment variable.

## 8. Auto-Update

In production builds, the app checks for updates from GitHub Releases automatically. When a new version is available:
1. Update downloads in the background
2. User sees a notification banner
3. Click "Install Update" to restart and apply

## 9. Project Structure

```
PressifyReprintApp/
├── .env                          # Database config
├── migration.sql                 # SQL to create reprint tables
├── package.json
├── forge.config.js               # Electron Forge config
├── webpack.main.config.js        # Webpack main process
├── webpack.renderer.config.js    # Webpack renderer process
├── .github/workflows/build.yml   # CI/CD pipeline
└── src/
    ├── main/
    │   ├── main.js               # Electron entry point
    │   ├── preload.js            # IPC bridge (contextBridge)
    │   ├── database.js           # MySQL connection pool
    │   ├── ipc-handlers.js       # All CRUD IPC handlers
    │   └── logger.js             # File-based logger
    └── renderer/
        ├── index.html
        ├── index.jsx             # React entry point
        ├── App.jsx               # Routes & role guards
        ├── contexts/
        │   └── AuthContext.jsx   # Login session
        └── components/
            ├── Layout.jsx        # Sidebar + top bar
            ├── Login.jsx
            ├── Dashboard.jsx     # Reprint statistics
            ├── ReprintList.jsx   # Reprint table + filters
            ├── ReprintForm.jsx   # Add/edit reprint modal
            ├── ProductList.jsx   # Products & variants CRUD
            ├── ProductImport.jsx # CSV import for products
            ├── Permission.jsx    # Users, reasons, order types
            └── Timeline.jsx      # Reprint audit log modal
```

## 10. Troubleshooting

**"Database init error" on startup**
- Make sure MySQL is running
- Check `.env` credentials are correct
- Verify the database exists: `mysql -u root -e "SHOW DATABASES LIKE 'pressify'"`

**"User not found" on login**
- The user must exist in the `users` table with `status = 'Active'`
- Password must be bcrypt hashed (`$2y$` or `$2a$` prefix)

**Blank screen after login**
- Open DevTools: `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS)
- Check Console tab for errors

**Migration fails**
- Make sure the `pressify` database exists before running migration.sql
- Tables use `IF NOT EXISTS` so it's safe to run multiple times

**Build fails with native module errors**
- Run `npm install` again to rebuild native modules
- On Windows, you may need Visual Studio Build Tools for native compilation

## 11. Logs

Application logs are written to:
- **Windows**: `%APPDATA%/Pressify Reprint/logs/app-YYYY-MM-DD.log`
- **macOS**: `~/Library/Application Support/Pressify Reprint/logs/app-YYYY-MM-DD.log`
- **Linux**: `~/.config/Pressify Reprint/logs/app-YYYY-MM-DD.log`

Log files rotate at 5MB.
