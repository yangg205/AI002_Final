# JoyfulMind — ứng dụng hỗ trợ cảm xúc bằng AI

App Expo / React Native / TypeScript cho web, Android và iOS. Backend được triển
khai độc lập; app chỉ kết nối tới URL API được cấu hình qua `EXPO_PUBLIC_API_URL`.

## Chạy trên máy hiện tại

Chạy frontend:

```bash
npm run web
```

Mặc định web gọi API tại cùng hostname, cổng 8000. Để đổi địa chỉ, dùng nút
**Cài đặt kết nối** trong tab **Tâm sự**, hoặc tạo `.env` từ `.env.example` và
đặt `EXPO_PUBLIC_API_URL`. Khởi động lại Expo sau khi đổi biến môi trường.
Địa chỉ chỉnh trong giao diện chỉ được giữ trong phiên hiện tại.

## Các luồng đã hoàn thiện

- **Tâm sự:** gửi tin nhắn và ngữ cảnh đến AI; trạng thái chờ, hủy chờ, gửi lại,
  sửa tin lỗi, cuộc trò chuyện mới; phân biệt phản hồi AI, kịch bản và lỗi tra cứu.
  Câu hỏi hướng dẫn được định tuyến qua tài liệu WHO, kèm trang nguồn khi có kết quả.
  Lời chào và lịch sử gửi lên API đồng nhất với giao diện Streamlit; nhãn dưới
  mỗi phản hồi xác nhận lượt đó được xử lý bởi backend `chatbot-demo`.
- **PSS-10:** người dùng đồng ý trước khi làm bài, trả lời đủ 10 câu, quay lại sửa,
  dừng, gửi lại khi lỗi, xem điểm /40 và gợi ý từ backend. Điểm được tính bằng mã
  xác định, không nhờ AI chấm. Có đường dẫn từ gợi ý chat đến bài đánh giá.
- **Ghi nhận tâm trạng:** chọn cảm xúc và mức tự cảm nhận, lưu tối đa 20 bản ghi
  trong phiên, xem và xóa lịch sử. Thanh tự cảm nhận khác với điểm PSS-10.
- **Bài tập:** hướng dẫn, đếm thời gian, tạm dừng, tiếp tục, đặt lại, hoàn thành.
  Tự tạm dừng khi rời tab hoặc chuyển ứng dụng. Nhạc do người dùng tự mở.
- **Hỗ trợ:** thêm/sửa liên hệ tin cậy trong phiên, mở ứng dụng gọi điện, nút
  cấp cứu y tế Việt Nam 115, chuyển sang chat và bài tập.

Hội thoại, bản ghi tâm trạng và liên hệ chỉ nằm trong bộ nhớ của phiên đang mở;
không còn sau khi tải lại/đóng ứng dụng. Khi dùng AI, nội dung được gửi đến máy
chủ và nhà cung cấp AI; backend che một số thông tin nhận diện trước khi gửi.
Ứng dụng không phải công cụ chẩn đoán hay dịch vụ cấp cứu.

## Thiết lập trên máy khác

Cần Node.js >=22.13.

```bash
npm ci
```

Đặt URL backend độc lập trong `.env`:

```bash
EXPO_PUBLIC_API_URL=https://<dia-chi-backend-cua-ban>
```

## Android / iPhone

```bash
npm start
```

- Điện thoại thật cần dùng URL backend có thể truy cập từ cùng mạng hoặc Internet.
- Bản phát hành nên dùng API HTTPS và backend cần cấu hình CORS cho domain của app.

Các lệnh native: `npm run android`, `npm run ios`; tạo native project bằng
`npm run android:native` / `npm run ios:native`. Cấu hình EAS có trong `eas.json`.
iOS cần macOS/Xcode hoặc EAS Build; đặt bundle identifier của bạn trước phát hành.

## Kiểm thử

```bash
npm run typecheck
npm test
npm run export
```

Kiểm thử bao gồm gửi lại chat không trùng tin, bỏ phản hồi cũ sau reset, xử lý
mất kết nối, luồng PSS-10, ranh giới điểm, bộ đếm, liên hệ, CORS và che PII.
Kiểm thử API không gọi nhà cung cấp AI và cần mở được cổng localhost tạm thời.

## Cấu trúc

- `App.tsx`: điều hướng và giữ trạng thái các tab.
- `src/services/api.ts`: cấu hình kết nối, timeout/hủy, kiểm tra phản hồi.
- `src/screens/`: chat, tâm trạng, bài tập và hỗ trợ.
- `src/components/PssAssessment.tsx`: luồng PSS-10.
- `legacy_flutter/`: mã Flutter cũ để đối chiếu.

Backend cần cung cấp các endpoint `/api/health`, `/api/chat`,
`/api/assessment/questions`, `/api/assessment/score` và các endpoint tài khoản
theo hợp đồng mà `src/services/api.ts` đang sử dụng. Trong monorepo này, xem
hướng dẫn chạy cả frontend và backend ở [README gốc](../README.md). Có thể chạy
API backend trực tiếp từ thư mục `chatbot-demo/`:

```bash
cd ../chatbot-demo
uvicorn src.api:app --host 0.0.0.0 --port 8000
```

Khi cần đổi địa chỉ API, đặt `EXPO_PUBLIC_API_URL` trong `.env` của frontend.
Hướng dẫn thở nhẹ tham khảo [NHS](https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/);
số cấp cứu y tế Việt Nam tham khảo [GOV.UK](https://www.gov.uk/foreign-travel-advice/vietnam/health).
