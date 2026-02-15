# Desktop Application Requirements Document

## 1. Tổng quan

Tài liệu này mô tả các yêu cầu kỹ thuật và kiến trúc cho một **desktop application** có các đặc điểm:

- Chạy trên desktop (Windows / macOS / Linux)
- Giao diện hiện đại, giống web app
- Kết nối backend thông qua API
- Hỗ trợ realtime data (live update)
- Tự động cập nhật khi có thay đổi code trên GitHub (branch main/master)

Tài liệu **chưa mô tả chi tiết nghiệp vụ chức năng**, phần đó sẽ được bổ sung sau.

---

## 2. Mục tiêu hệ thống

- Cung cấp một desktop app ổn định, dễ sử dụng
- Hiển thị dữ liệu realtime từ backend
- Giảm thiểu thao tác cập nhật thủ công từ phía người dùng
- Đảm bảo khả năng mở rộng và bảo trì lâu dài

---

## 3. Phạm vi (Scope)

### Bao gồm
- Desktop application frontend
- Cơ chế auto-update thông qua GitHub
- Kết nối API và realtime
- Quản lý phiên bản ứng dụng

### Không bao gồm
- Logic nghiệp vụ backend
- Triển khai hạ tầng backend
- Chi tiết UI/UX theo từng chức năng

---

## 4. Kiến trúc tổng thể

### 4.1 Kiến trúc mức cao

```
[ Desktop App ]
      |
      | REST API / WebSocket / SSE
      |
[ Backend Service ]

[ GitHub Repository ]
      |
      | GitHub Actions
      |
[ GitHub Releases ]
      |
[ Auto Update Mechanism ]
```

---

## 5. Công nghệ đề xuất

### 5.1 Desktop Application

- Framework: Electron hoặc Tauri
- UI Framework: React (hoặc Vue)
- Styling: Tailwind CSS
- Ngôn ngữ: TypeScript / JavaScript

### 5.2 Realtime Communication

- WebSocket hoặc Socket.IO
- Hoặc Server-Sent Events (SSE)

### 5.3 Auto Update

- Electron: `electron-updater`
- Update source: GitHub Releases

### 5.4 CI/CD

- GitHub Actions
- Trigger khi có thay đổi trên branch `main` / `master`

---

## 6. Cơ chế cập nhật ứng dụng (Auto Update)

### 6.1 Nguyên tắc

- Ứng dụng **không update trực tiếp từ branch code**
- Update thông qua **GitHub Releases**
- Mỗi phiên bản ứng dụng có version rõ ràng

### 6.2 Luồng hoạt động

1. Developer push code lên branch `main`
2. GitHub Actions tự động build ứng dụng
3. Build artifact được upload lên GitHub Release
4. Desktop app khi khởi động:
   - Kiểm tra version mới
   - Tải bản update nếu có
   - Cài đặt khi restart app

---

## 7. Quản lý phiên bản (Versioning)

- Sử dụng Semantic Versioning: `MAJOR.MINOR.PATCH`
- Version được khai báo trong cấu hình ứng dụng
- Auto update chỉ hoạt động khi version mới cao hơn

---

## 8. Kết nối Backend API

### 8.1 REST API

- Giao tiếp thông qua HTTPS
- Định dạng dữ liệu: JSON
- Hỗ trợ xác thực (ví dụ: JWT)

### 8.2 Realtime API

- Kết nối realtime khi app đang chạy
- Nhận dữ liệu push từ backend
- Tự động reconnect khi mất kết nối

---

## 9. Bảo mật

- Mã hóa kết nối (HTTPS / WSS)
- Lưu trữ token an toàn trên máy người dùng
- Kiểm soát quyền truy cập API
- Xác thực nguồn update từ GitHub

---

## 10. Yêu cầu hiệu năng

- Thời gian khởi động ứng dụng nhanh
- Realtime update không gây lag UI
- Auto update chạy nền, không chặn người dùng

---

## 11. Khả năng mở rộng & bảo trì

- Tách biệt UI và logic backend
- Dễ dàng thêm module chức năng mới
- Dễ nâng cấp framework và thư viện

---

## 12. Yêu cầu đa nền tảng

- Windows (x64)
- macOS (Intel / Apple Silicon)
- Linux (AppImage hoặc tương đương)

---

## 13. Logging & Monitoring

- Log lỗi phía client
- Hỗ trợ gửi log về backend (tuỳ chọn)
- Hỗ trợ debug khi gặp sự cố

---

## 14. Chức năng ứng dụng

> **Phần này để trống – sẽ được định nghĩa chi tiết sau**

-
-
-
-

---

## 15. Yêu cầu chưa xác định (Open Questions)

- Cơ chế xác thực người dùng cụ thể
- Chi tiết UI/UX
- Chính sách update (bắt buộc hay tuỳ chọn)
- Quy mô người dùng

---

## 16. Ghi chú

Tài liệu này là nền tảng để:
- Trao đổi kỹ thuật
- Làm việc với AI code (Claude)
- Làm tài liệu thiết kế & triển khai sau này

