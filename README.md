# JoyfulMind — FE và BE

Monorepo gồm ứng dụng Expo/React Native ở `App_AI002/` và backend FastAPI cùng
ứng dụng Streamlit ở `chatbot-demo/`.

## Chạy toàn bộ trên máy local

Cần Docker Desktop (Docker Compose), Node.js `>=22.13` và npm.

### 1. Khởi động backend

```bash
cd chatbot-demo
cp .env.example .env
```

Mở `chatbot-demo/.env` và điền `GROQ_API_KEY`, `GEMINI_API_KEY` nếu muốn bật
đầy đủ phản hồi AI và tư vấn dựa trên tài liệu. Để dùng đăng ký/đăng nhập, tạo
secret riêng bằng `openssl rand -hex 32` rồi điền vào `AUTH_TOKEN_SECRET`.

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f app api
```

Lần chạy đầu có thể mất thêm thời gian để tải image và tạo chỉ mục tài liệu.
Backend API ở <http://localhost:8000>; tài liệu API ở
<http://localhost:8000/docs>. Giao diện Streamlit tùy chọn ở
<http://localhost:8501>.

Không có API key, backend vẫn chạy để thử health check, bài đánh giá và phản hồi
mẫu. Chat AI cần `GROQ_API_KEY`; tư vấn có trích dẫn tài liệu cần
`GEMINI_API_KEY` để tạo chỉ mục. Giữ cửa sổ log mở lần đầu để theo dõi quá trình
khởi tạo.

### 2. Chạy frontend

Mở terminal khác tại thư mục gốc:

```bash
cd App_AI002
npm ci
npm run web
```

Mở URL Expo in ra terminal (thường là <http://localhost:8081>). Khi chạy web,
app mặc định gọi API ở `http://localhost:8000`.

Để chạy Android Emulator:

```bash
cd App_AI002
npm start
```

Ứng dụng tự dùng `10.0.2.2:8000` cho Android Emulator. Với điện thoại thật, tạo
`App_AI002/.env` từ `.env.example`, đặt `EXPO_PUBLIC_API_URL` thành địa chỉ LAN
của máy đang chạy Docker, ví dụ `http://192.168.1.20:8000`, rồi khởi động lại
Expo. Điện thoại và máy tính cần cùng mạng.

### Dừng các dịch vụ

```bash
cd chatbot-demo
docker compose down
```

Muốn xóa cả dữ liệu Postgres và chỉ mục đã tạo: `docker compose down -v`.

## Kiểm tra nhanh

```bash
curl http://localhost:8000/api/health
```

Trong `App_AI002/`, có thể chạy kiểm tra frontend:

```bash
npm run typecheck
npm test
```

## Thư mục dự án

- `App_AI002/`: frontend Expo cho web, Android và iOS.
- `chatbot-demo/`: API FastAPI, ứng dụng Streamlit, dữ liệu và Docker Compose.
- `App_AI002/legacy_flutter/`: mã Flutter cũ để tham khảo.

Xem thêm hướng dẫn backend trong [`chatbot-demo/README.md`](chatbot-demo/README.md)
và frontend trong [`App_AI002/README.md`](App_AI002/README.md).
