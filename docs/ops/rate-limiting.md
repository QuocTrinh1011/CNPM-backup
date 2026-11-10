# Rate Limiting

Backend áp dụng 2 tầng giới hạn lượng request qua filter `security/RateLimitFilter.java` (chạy trước `AdminAccessGuard`). Trạng thái lưu **in-memory trong một node** (`security/RateLimitStore.java`), reset khi restart — không dùng Redis.

## Tầng 1 — Toàn bộ API

- Token bucket theo **IP**: mặc định **120 request/phút/IP**, refill dần theo thờI gian.
- IP được lấy từ hop đầu header `X-Forwarded-For` (Render proxy), fallback `remoteAddr`.
- Khi hết token: `429` + header `Retry-After` (giây).

## Tầng 2 — Route xác thực

- Áp dụng cho POST: `/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/change-password`, `/api/admin/auth/login`, `/api/manager/auth/login`.
- Chỉ tính request **thất bại** (response status >= 400). Đăng nhập đúng không bao giờ bị tính.
- Mặc định tối đa **5 lần thất bại / 15 phút**.
- Key = `IP + email` lấy từ body request (chuẩn hóa lowercase). Route không có email trong body (change-password, refresh, logout) dùng key `IP only` — một ngườI dùng khác cùng mạng không bị vạ lây.
- Khi vượt ngưỡng: `429` + `Retry-After` = thờI gian còn lại của cửa sổ.

## Miễn trừ

- `OPTIONS` (CORS preflight).
- `POST /api/payments/payos/webhook` — PayOS retry không bị chặn theo số lượng, nhưng vẫn áp dụng giới hạn kích thước payload.

## Giới hạn kích thước payload

- Body JSON tối đa **1 MB** (`app.request.max-body-bytes` / `MAX_BODY_BYTES`); vượt quá → `413` `PAYLOAD_TOO_LARGE`.
- Multipart (nếu dùng sau này): `max-file-size` / `max-request-size` = 2 MB trong `application.yml`.
- JSON sai định dạng, sai kiểu tham số, thiếu param → `400` (`INVALID_JSON` / `VALIDATION_ERROR`) thay vì `500`; route không tồn tại → `404`; sai method → `405`.

## Response 429

```json
{"code":"RATE_LIMITED","message":"Quá nhiều yêu cầu. Vui lòng thử lại sau."}
```

## Cấu hình (application.yml / env)

| Key | Env | Mặc định |
|---|---|---|
| `app.rate-limit.enabled` | `RATE_LIMIT_ENABLED` | `true` |
| `app.rate-limit.per-minute` | `RATE_LIMIT_PER_MINUTE` | `120` |
| `app.rate-limit.auth-max-attempts` | `AUTH_MAX_ATTEMPTS` | `5` |
| `app.rate-limit.auth-window-minutes` | `AUTH_WINDOW_MINUTES` | `15` |
| `app.request.max-body-bytes` | `MAX_BODY_BYTES` | `1048576` |

## Lưu ý

- Single-node: nếu scale nhiều instance, cần đổi sang Redis/bucket tập trung.
- Muốn tắt toàn bộ: `RATE_LIMIT_ENABLED=false`.
