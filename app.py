#!/usr/bin/env python3
"""Local YouTube music streamer. Stdlib-only HTTP server + yt-dlp subprocess."""
import json
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
YTDLP = ROOT / "bin" / "yt-dlp"
STATIC = ROOT / "static"
PORT = 8765


def run_ytdlp(args: list[str], timeout: int = 30) -> subprocess.CompletedProcess:
    return subprocess.run(
        [str(YTDLP), *args],
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )


def search_youtube(query: str, limit: int = 15) -> list[dict]:
    proc = run_ytdlp([
        f"ytsearch{limit}:{query}",
        "--flat-playlist",
        "--dump-json",
        "--no-warnings",
        "--default-search", "ytsearch",
    ])
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "yt-dlp search failed")
    items = []
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            continue
        items.append({
            "id": data.get("id"),
            "title": data.get("title"),
            "uploader": data.get("uploader") or data.get("channel"),
            "duration": data.get("duration"),
            "thumbnail": (data.get("thumbnails") or [{}])[0].get("url")
                         if isinstance(data.get("thumbnails"), list)
                         else data.get("thumbnail"),
        })
    return items


def get_video_info(video_id: str) -> dict:
    proc = run_ytdlp([
        f"https://www.youtube.com/watch?v={video_id}",
        "--dump-json",
        "--skip-download",
        "--no-warnings",
        "--no-playlist",
    ], timeout=20)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "yt-dlp info failed")
    line = (proc.stdout.strip().splitlines() or [""])[0]
    if not line:
        raise RuntimeError("no info returned")
    data = json.loads(line)
    thumb = data.get("thumbnail")
    if not thumb and isinstance(data.get("thumbnails"), list) and data["thumbnails"]:
        thumb = data["thumbnails"][-1].get("url")
    return {
        "id": data.get("id"),
        "title": data.get("title"),
        "uploader": data.get("uploader") or data.get("channel"),
        "duration": data.get("duration"),
        "thumbnail": thumb,
        "description": data.get("description") or "",
        "view_count": data.get("view_count"),
        "like_count": data.get("like_count"),
        "upload_date": data.get("upload_date"),
        "channel_url": data.get("channel_url") or data.get("uploader_url"),
    }


def get_audio_url(video_id: str) -> str:
    proc = run_ytdlp([
        f"https://www.youtube.com/watch?v={video_id}",
        "-f", "bestaudio[ext=m4a]/bestaudio",
        "--get-url",
        "--no-warnings",
    ])
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "yt-dlp resolve failed")
    url = proc.stdout.strip().splitlines()[-1] if proc.stdout.strip() else ""
    if not url.startswith("http"):
        raise RuntimeError("no audio URL returned")
    return url


def get_video_url(video_id: str) -> str:
    # Single-file muxed mp4 (H.264 + AAC) — browser <video> tag play native, không cần ffmpeg client side.
    proc = run_ytdlp([
        f"https://www.youtube.com/watch?v={video_id}",
        "-f", "best[ext=mp4][vcodec^=avc1]/best[ext=mp4]/best",
        "--get-url",
        "--no-warnings",
    ])
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "yt-dlp resolve failed")
    url = proc.stdout.strip().splitlines()[-1] if proc.stdout.strip() else ""
    if not url.startswith("http"):
        raise RuntimeError("no video URL returned")
    return url


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def _json(self, status: int, payload: dict | list) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _file(self, path: Path, ctype: str) -> None:
        if not path.is_file():
            self.send_error(404)
            return
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urlparse(self.path)
        qs = parse_qs(url.query)

        if url.path in ("/", "/index.html", "/watch"):
            self._file(STATIC / "index.html", "text/html; charset=utf-8")
            return
        if url.path.startswith("/js/") and url.path.endswith(".js") and ".." not in url.path:
            rel = url.path[1:]  # strip leading "/"
            self._file(STATIC / rel, "application/javascript; charset=utf-8")
            return
        if url.path == "/style.css":
            self._file(STATIC / "style.css", "text/css; charset=utf-8")
            return
        if url.path in ("/favicon.svg", "/favicon.ico"):
            self._file(STATIC / "favicon.svg", "image/svg+xml")
            return

        if url.path == "/api/search":
            q = (qs.get("q") or [""])[0].strip()
            if not q:
                self._json(400, {"error": "q required"})
                return
            try:
                limit = int((qs.get("limit") or ["15"])[0])
            except ValueError:
                limit = 15
            limit = max(1, min(limit, 60))
            try:
                self._json(200, {"items": search_youtube(q, limit=limit), "limit": limit})
            except Exception as exc:
                self._json(500, {"error": str(exc)})
            return

        if url.path == "/api/shorts":
            raw = (qs.get("q") or ["#shorts"])[0].strip() or "#shorts"
            # Help YouTube prioritise short-form by appending "#shorts" if not already present.
            q = raw if "shorts" in raw.lower() else f"{raw} #shorts"
            try:
                limit = int((qs.get("limit") or ["30"])[0])
            except ValueError:
                limit = 30
            # Higher cap than /api/search because duration filter drops ~70% of results; need more raw to fill the feed.
            limit = max(1, min(limit, 120))
            try:
                items = search_youtube(q, limit=limit)
                # Relax threshold to 180s — many short-form clips are 1-3 minutes; strict 60s filter often empties results.
                shorts = [it for it in items if (it.get("duration") or 9999) <= 180]
                self._json(200, {"items": shorts, "limit": limit, "raw_count": len(items)})
            except Exception as exc:
                self._json(500, {"error": str(exc)})
            return

        if url.path == "/api/detail":
            vid = (qs.get("id") or [""])[0].strip()
            if not vid:
                self._json(400, {"error": "id required"})
                return
            try:
                info = get_video_info(vid)
                related = []
                if info.get("title"):
                    try:
                        related = [
                            it for it in search_youtube(info["title"], limit=10)
                            if it.get("id") and it["id"] != info["id"]
                        ][:8]
                    except Exception:
                        related = []
                self._json(200, {"info": info, "related": related})
            except Exception as exc:
                self._json(502, {"error": str(exc)})
            return

        if url.path == "/api/stream":
            vid = (qs.get("id") or [""])[0].strip()
            if not vid:
                self.send_error(400, "id required")
                return
            try:
                audio_url = get_audio_url(vid)
            except Exception as exc:
                self.send_error(502, str(exc))
                return
            self.send_response(302)
            self.send_header("Location", audio_url)
            self.end_headers()
            return

        if url.path == "/api/stream_video":
            vid = (qs.get("id") or [""])[0].strip()
            if not vid:
                self.send_error(400, "id required")
                return
            try:
                video_url = get_video_url(vid)
            except Exception as exc:
                self.send_error(502, str(exc))
                return
            self.send_response(302)
            self.send_header("Location", video_url)
            self.end_headers()
            return

        self.send_error(404)


def main():
    if not YTDLP.is_file():
        sys.exit(f"yt-dlp not found at {YTDLP}")
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Music player running at http://127.0.0.1:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()
