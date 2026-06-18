# Lucy Music

App xem/nghe YouTube chạy local trên Ubuntu, không cần cài pip/ffmpeg. Backend Python stdlib gọi `yt-dlp` binary để search và resolve URL stream trực tiếp; frontend là SPA vanilla JS.

## Stack
- Backend: Python stdlib (`http.server`, `ThreadingHTTPServer`) — không cần Flask, không cần venv
- Resolve/stream: `yt-dlp` standalone binary trong `./bin/yt-dlp`
- Frontend: HTML5 `<audio>`/`<video>` + ES modules (`static/js/*.js`), không build step

## Start

```bash
cd ~/IdeaProjects/python
python3 app.py
```

Server bind `127.0.0.1:8765`. Mở browser: <http://127.0.0.1:8765>

## Stop

`Ctrl+C` trong terminal đang chạy server, hoặc:

```bash
pkill -f "python3 app.py"
```

## Tính năng

- **Home** — tìm kiếm video/nghệ sĩ, kết quả cuộn vô hạn (infinite scroll)
- **Shorts** — feed clip ngắn (≤180s), vuốt dọc
- **Watch** — trang xem video (muxed mp4, play native trong `<video>`) kèm thông tin + danh sách video liên quan
- **Nghe nhạc** — phát audio-only qua `<audio>` từ `/api/stream`
- **Tìm bằng giọng nói** — nút mic dùng Web Speech API (cần Chrome/Edge)

## Chạy bằng Docker (sau shared gateway)

App này expose ra Internet qua **shared Caddy gateway** ở `~/IdeaProjects/gateway` (một domain ngrok → nhiều app theo path prefix). Music được route ở **`/music`** → `127.0.0.1:5300`. Project này **không tự chạy nginx/ngrok** nữa.

Container `app` (python stdlib) chạy với `BASE_PATH=/music` và publish ở `127.0.0.1:5300`.

### Cài Docker (lần đầu)

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
newgrp docker   # áp dụng group ngay, khỏi logout
```

### Build & start

```bash
cd ~/IdeaProjects/python
docker compose up -d --build
docker compose ps
docker compose logs -f
```

> Dockerfile set `ENV HOST=0.0.0.0` để container nghe được trên port đã publish (app.py đọc `HOST`/`PORT` từ env, mặc định `127.0.0.1:8765`).

### Đăng ký route ở gateway (đã cấu hình sẵn)

Trong `~/IdeaProjects/gateway`:
- `.env`: `MUSIC_PORT=5300`
- `Caddyfile`: khối `@music path /music /music/*` → `reverse_proxy 127.0.0.1:{$MUSIC_PORT:5300}` (đặt trước catch-all `/`)

Áp dụng khi đổi:
```bash
pm2 restart caddy-gateway                       # sau khi sửa Caddyfile
pm2 restart ecosystem.config.js --update-env    # sau khi sửa gateway/.env
```

### Truy cập

- <https://these-cadet-unaired.ngrok-free.dev/music> — public qua gateway + ngrok
- <http://localhost:5300/music> — trực tiếp container (bỏ qua gateway, dev/debug)

> Chạy local không Docker: `python3 app.py` (không set `BASE_PATH`) → phục vụ ở root <http://127.0.0.1:8765>.

### Stop

```bash
docker compose down
```

## Update yt-dlp

YouTube đổi format/cipher thường xuyên — nếu một ngày app báo lỗi resolve, update binary:

```bash
curl -fsSL -o bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp
chmod +x bin/yt-dlp
```

## Cấu trúc

```
python/
├── app.py                  # HTTP server + 5 API endpoint, gọi yt-dlp qua subprocess
├── bin/yt-dlp              # standalone binary
├── static/
│   ├── index.html          # SPA shell (các "stack": home / shorts / watch)
│   ├── style.css
│   ├── favicon.svg
│   └── js/                 # ES modules
│       ├── main.js         # entry, wire-up
│       ├── api.js          # wrapper gọi backend API
│       ├── state.js        # app state
│       ├── stacks.js       # điều hướng giữa các màn
│       ├── pages.js        # render home + kết quả search
│       ├── shorts.js       # feed shorts
│       ├── video.js        # trang watch / player video
│       ├── panels.js       # panel chi tiết / queue
│       ├── voice.js        # voice search (Web Speech API)
│       ├── dom.js / util.js # util.js có withBase() — build URL theo BASE_PATH
├── Dockerfile              # python:3.12-slim + app
├── docker-compose.yml      # app (BASE_PATH=/music, publish 127.0.0.1:5300)
└── README.md
```

> Routing public/reverse-proxy nằm ở `~/IdeaProjects/gateway` (shared Caddy + ngrok), không thuộc repo này.

## API endpoint

| Endpoint | Mô tả |
|---|---|
| `GET /` , `GET /watch` | UI (cùng `index.html`) |
| `GET /api/search?q=<kw>&limit=<n>` | Search YouTube → JSON list (limit 1–60, mặc định 15) |
| `GET /api/shorts?q=<kw>&limit=<n>` | Feed clip ngắn ≤180s (limit 1–120, mặc định 30) |
| `GET /api/detail?id=<video_id>` | Thông tin video + danh sách liên quan |
| `GET /api/stream?id=<video_id>` | 302 redirect tới audio URL trực tiếp (`<audio>`) |
| `GET /api/stream_video?id=<video_id>` | 302 redirect tới muxed mp4 URL (`<video>`) |
