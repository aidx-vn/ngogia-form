# Hệ thống Khảo sát — Họ Ngô Việt Nam

Khung khảo sát: đăng nhập Google/Facebook, trả lời câu hỏi sinh từ JSON template, admin dashboard, tùy chỉnh giao diện (màu sắc, font chữ, logo).

## Kiến trúc

| Thành phần | Công nghệ |
|---|---|
| Backend | Go 1.25, chi router, GORM, JWT (httpOnly cookie), OAuth2 |
| Database | PostgreSQL (container `infra_postgres` có sẵn), kết nối qua **PgBouncer** (`infra_pgbouncer`, port **5433**, transaction pooling → GORM bật `PreferSimpleProtocol`) |
| Frontend | Vite + React + TypeScript + Tailwind CSS v4, react-router |

```
form/
├── backend/
│   ├── main.go                 # routes + middleware
│   ├── internal/
│   │   ├── config/             # env vars
│   │   ├── db/                 # connect + migrate + seed
│   │   ├── models/             # User, Survey, Response, Setting
│   │   ├── auth/               # OAuth Google/Facebook, JWT, middleware
│   │   └── handlers/           # surveys, responses, admin, settings
│   └── seed/*.json             # khảo sát mẫu (tự nạp khi DB trống)
└── frontend/
    └── src/
        ├── context.tsx          # auth + theme (CSS variables)
        ├── components/QuestionField.tsx   # render câu hỏi theo type
        └── pages/               # Login, SurveyList, SurveyPage, ThankYou, admin/*
```

## Chạy local

```powershell
# 1. Backend (cổng 8080) — DB đã trỏ sẵn PgBouncer localhost:5433
cd backend
go run .

# 2. Frontend (cổng 5173, proxy /api -> 8080)
cd frontend
npm install
npm run dev
```

Mở http://localhost:5173. Khi **chưa** khai báo OAuth, trang đăng nhập hiện nút **Dev login** (Người dùng / Quản trị) — bật bởi `DEV_AUTH=1` (mặc định). Đặt `DEV_AUTH=0` ở production.

## Biến môi trường (backend)

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `PORT` | `8080` | |
| `DATABASE_URL` | `postgres://pgadmin:trust@localhost:5433/survey?sslmode=disable` | qua PgBouncer |
| `JWT_SECRET` | dev value | **bắt buộc đổi** ở production |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | _(trống)_ | bật nút Google |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | _(trống)_ | bật nút Facebook |
| `FRONTEND_URL` | `http://localhost:5173` | đích redirect sau đăng nhập |
| `BACKEND_URL` | `http://localhost:8080` | gốc của callback URL |
| `DEV_AUTH` | `1` | `0` = tắt dev login |
| `ADMIN_EMAILS` | _(trống)_ | danh sách email (phẩy) tự gán quyền admin khi đăng nhập |

## Đăng nhập Google — từng bước

1. Vào https://console.cloud.google.com/ → tạo Project mới (hoặc chọn project có sẵn).
2. Menu **APIs & Services → OAuth consent screen**:
   - Chọn **External** → điền App name, support email → Save.
   - Scopes: thêm `openid`, `email`, `profile` (non-sensitive) → Save.
   - Test users: thêm email của bạn (khi app ở chế độ Testing chỉ test user đăng nhập được).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized JavaScript origins: `http://localhost:5173`, `http://localhost:8080`.
   - Authorized redirect URIs: `http://localhost:8080/api/auth/google/callback`.
4. Copy **Client ID** và **Client Secret**, chạy backend:
   ```powershell
   $env:GOOGLE_CLIENT_ID = "xxx.apps.googleusercontent.com"
   $env:GOOGLE_CLIENT_SECRET = "GOCSPX-..."
   go run .
   ```
5. Nút "Tiếp tục với Google" tự xuất hiện ở trang đăng nhập.

Luồng kỹ thuật: nút Google → `GET /api/auth/google/login` (backend sinh `state` chống CSRF, redirect sang Google) → người dùng đồng ý → Google redirect về `/api/auth/google/callback?code=...&state=...` → backend kiểm `state`, đổi `code` lấy access token, gọi `userinfo` lấy id/email/tên/avatar → upsert user → ký JWT, set cookie `session` (httpOnly) → redirect về frontend.

## Đăng nhập Facebook — từng bước

1. Vào https://developers.facebook.com/ → **My Apps → Create App** → use case **Authenticate and request data from users with Facebook Login** → type **Consumer**.
2. Trong app dashboard: **Add Product → Facebook Login → Set up** → chọn **Web** → Site URL: `http://localhost:5173`.
3. **Facebook Login → Settings**:
   - Valid OAuth Redirect URIs: `http://localhost:8080/api/auth/facebook/callback`.
   - Lưu ý: với localhost, Facebook tự cho phép redirect khi app ở **Development mode**.
4. **App Settings → Basic**: copy **App ID** và **App Secret**. Thêm email liên hệ, lưu.
5. Development mode: chỉ tài khoản có role trong app (Roles → thêm Testers/Developers) đăng nhập được. Lên production cần App Review để lấy quyền `email`.
6. Chạy backend:
   ```powershell
   $env:FACEBOOK_CLIENT_ID = "App ID"
   $env:FACEBOOK_CLIENT_SECRET = "App Secret"
   go run .
   ```

Luồng kỹ thuật giống Google, userinfo lấy từ Graph API `me?fields=id,name,email,picture`.

> Lưu ý: tài khoản Facebook ẩn email có thể trả về email rỗng — hệ thống vẫn tạo user theo `provider + provider_id`.

## Gán quyền admin

- Dev: nút "Đăng nhập Dev (Quản trị)".
- OAuth thật: đặt `ADMIN_EMAILS=admin@example.com,khac@example.com` trước khi chạy backend — đăng nhập bằng email đó tự có role admin.

## JSON template khảo sát

Survey lưu `schema` JSONB. Đầy đủ các loại:

```json
{
  "questions": [
    { "id": "q1", "type": "single_choice", "label": "Một lựa chọn?", "required": true,
      "options": [ { "value": "a", "label": "A" }, { "value": "b", "label": "B" } ] },
    { "id": "q2", "type": "multiple_choice", "label": "Nhiều lựa chọn?", "required": false,
      "options": [ { "value": "x", "label": "X" }, { "value": "y", "label": "Y" } ] },
    { "id": "q3", "type": "rating",   "label": "Sao 1-5",      "required": true,  "min": 1, "max": 5 },
    { "id": "q4", "type": "scale",    "label": "Thang 0-10",   "required": false, "min": 0, "max": 10 },
    { "id": "q5", "type": "text",     "label": "Trả lời ngắn", "required": false },
    { "id": "q6", "type": "textarea", "label": "Trả lời dài",  "required": false, "help": "Gợi ý hiển thị dưới câu hỏi" },
    { "id": "q7", "type": "number",   "label": "Con số",       "required": false, "min": 0 },
    { "id": "q8", "type": "date",     "label": "Ngày (YYYY-MM-DD)", "required": false }
  ]
}
```

Backend validate answers theo schema (required, option hợp lệ, min/max, định dạng ngày). Mỗi user trả lời 1 lần/khảo sát (unique index `survey_id + user_id`).

## API chính

| Method | Path | Quyền |
|---|---|---|
| GET | `/api/auth/{google\|facebook}/login` → `/callback` | public |
| GET | `/api/auth/me` · POST `/api/auth/logout` | public/auth |
| GET | `/api/settings` | public (theme) |
| GET | `/api/surveys` · `/api/surveys/{id}` | public (active) |
| POST | `/api/surveys/{id}/responses` · GET `/{id}/my-response` | đăng nhập |
| GET | `/api/admin/stats` | admin |
| CRUD | `/api/admin/surveys[/{id}]` | admin |
| GET | `/api/admin/surveys/{id}/responses` · `/{id}/stats` | admin |
| PUT | `/api/admin/settings` | admin (app_name, primary_color, font_family, logo_url) |

## Ghi chú hạ tầng local

- DB `survey` đã tạo trong `infra_postgres`.
- Đã thêm `auth_file = /etc/pgbouncer/userlist.txt` vào `D:\aidx\devops\local\local-infra\pgbouncer\pgbouncer.ini` và ghi `"pgadmin" "..."` vào userlist trong container — trước đó PgBouncer `auth_type=trust` từ chối mọi user vì userlist rỗng. Nếu recreate container `infra_pgbouncer`, cần ghi lại userlist:
  ```powershell
  docker exec infra_pgbouncer sh -c 'echo "\"pgadmin\" \"StrongPass!2025\"" > /etc/pgbouncer/userlist.txt'
  docker restart infra_pgbouncer
  ```
