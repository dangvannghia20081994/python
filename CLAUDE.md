# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Lucy Music" — a local YouTube viewer/player. A stdlib-only Python HTTP server shells out to a bundled `yt-dlp` binary to search YouTube and resolve direct stream URLs; the frontend is a no-build vanilla-JS SPA. No pip packages, no venv, no ffmpeg.

## Commands

```bash
python3 app.py                       # run server, binds 127.0.0.1:8765
pkill -f "python3 app.py"            # stop

docker compose up -d --build         # app + nginx (:8080) + ngrok
docker compose logs -f
docker compose down

# update yt-dlp when YouTube breaks resolve (format/cipher changes)
curl -fsSL -o bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp && chmod +x bin/yt-dlp
```

There are no tests, linter, or build step. `static/js/*.js` are ES modules served as-is — no bundler.

## Architecture

**Backend — `app.py` (single file).** `ThreadingHTTPServer` + one `Handler.do_GET`. Every YouTube operation is a `yt-dlp` subprocess via `run_ytdlp()`; there is no API client library and no caching. Endpoints:

- `/`, `/watch`, `/index.html` → all serve `static/index.html` (SPA — routing is client-side)
- static: `/js/*.js`, `/style.css`, `/favicon.svg` (path-traversal guarded by `".." not in path`)
- `/api/search` → `ytsearchN:` flat-playlist JSON list
- `/api/shorts` → same search, appends `#shorts`, filters to duration ≤180s (higher raw limit because the filter drops most results)
- `/api/detail` → full video info + related (a second search on the title)
- `/api/stream` → **302 redirect** to a direct googlevideo audio URL (bestaudio m4a)
- `/api/stream_video` → **302 redirect** to a muxed mp4 URL (avc1+aac, so the browser `<video>` plays it natively — no client-side ffmpeg)

The 302-redirect pattern is deliberate: the server never proxies media bytes, it only resolves URLs and hands them to the browser. Nginx config sets `proxy_redirect off` so the browser follows the redirect to googlevideo directly.

**Frontend — `static/js/` ES modules.** `main.js` is the entry point. The UI is organized as "stacks" (home / shorts / watch screens) navigated client-side by `stacks.js`. `api.js` wraps the backend endpoints; `pages.js` renders home + search results; `shorts.js`, `video.js` drive their feeds; `voice.js` is Web Speech API search; `state.js` holds app state; `dom.js`/`util.js` are helpers.

## Conventions & gotchas

- The working dir is named `python/` but the app is "Lucy Music" (README and older docs may say `music-player`).
- Code comments are in Vietnamese; keep that style when editing.
- `app.py` binds `127.0.0.1`. The Dockerfile rewrites this to `0.0.0.0` with `sed` at build time so nginx can reach it inside the container network — do not hardcode `0.0.0.0` in source.
- `PORT = 8765` is a module constant in `app.py`.
- Docker exposes the app **only through nginx on host port 8080** (not 80). ngrok needs `NGROK_AUTHTOKEN` in `.env`; its public URL is pinned in `docker-compose.yml`.
- `bin/yt-dlp` is committed to the repo (it's the runtime dependency, not a dev tool).
