# Lucy Music

App nghe nhạc YouTube chạy local trên Ubuntu, không cần cài pip/ffmpeg.

## Stack
- Backend: Python stdlib (`http.server`) — không cần Flask, không cần venv
- Stream: `yt-dlp` standalone binary trong `./bin/yt-dlp`
- Frontend: HTML5 audio + vanilla JS

## Start

```bash
cd ~/IdeaProjects/music-player
python3 app.py
```

Mở browser: <http://127.0.0.1:8765>

## Stop

`Ctrl+C` trong terminal đang chạy server, hoặc:

```bash
pkill -f "python3 app.py"
```

## Cách dùng

1. Gõ tên bài/nghệ sĩ vào ô tìm kiếm → Enter
2. Bấm **Phát** để nghe ngay, hoặc **+ Hàng đợi** để thêm vào playlist
3. Bấm tên bài trong cột "Hàng đợi" bên phải để nhảy tới bài đó
4. Khi 1 bài kết thúc, app tự chuyển sang bài kế tiếp trong queue

## Chạy bằng Docker + Nginx (music.nip.io)

Stack: container `app` (python stdlib) + container `nginx` reverse proxy port 80 → `app:8765`.

### Cài Docker (lần đầu)

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
newgrp docker   # áp dụng group ngay, khỏi logout
```

### Build & start

```bash
cd ~/IdeaProjects/music-player
docker compose up -d --build
docker compose ps
docker compose logs -f
```

### Truy cập

- <http://music.10.9.17.80.nip.io> — nip.io tự resolve `<name>.<ip>.nip.io` về IP đó, work ngay
- <http://localhost> — cũng work
- <http://music.nip.io> — cần thêm `/etc/hosts`:
  ```bash
  echo "127.0.0.1 music.nip.io" | sudo tee -a /etc/hosts
  ```

> Nếu máy đổi IP, sửa `server_name` trong `nginx/default.conf` rồi `docker compose restart nginx`.

### Stop

```bash
docker compose down
```

### Cấu trúc Docker

```
├── Dockerfile               # python:3.12-slim + app
├── docker-compose.yml       # app + nginx
├── .dockerignore
└── nginx/
    └── default.conf         # reverse proxy music.nip.io → app:8765
```

## Update yt-dlp

YouTube đổi format/cipher thường xuyên — nếu một ngày app báo lỗi, update binary:

```bash
curl -fsSL -o bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp
chmod +x bin/yt-dlp
```

## Cấu trúc

```
music-player/
├── app.py                # HTTP server
├── bin/yt-dlp            # standalone binary
├── static/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── Dockerfile
├── docker-compose.yml
├── nginx/default.conf
└── README.md
```

## Endpoint

- `GET /` → UI
- `GET /api/search?q=<keyword>` → JSON list 15 kết quả YouTube
- `GET /api/stream?id=<video_id>` → 302 redirect tới audio URL trực tiếp (browser play qua `<audio>`)
