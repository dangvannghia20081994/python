# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Lucy Music" — a local YouTube viewer/player. A stdlib-only Python HTTP server shells out to a bundled `yt-dlp` binary to search YouTube and resolve direct stream URLs; the frontend is a no-build vanilla-JS SPA. No pip packages, no venv, no ffmpeg.

## Commands

```bash
python3 app.py                       # run at root, binds 127.0.0.1:8765 (BASE_PATH unset)
kill <pid>                           # stop (avoid `pkill -f "app.py"` — it matches your own shell)

docker compose up -d --build         # app only, BASE_PATH=/music, published on 127.0.0.1:5300
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
- **Base-path support.** `BASE_PATH` env (default empty) is the prefix the app is served under. `app.py` strips it from incoming request paths and injects it into `index.html` as `window.__BASE__` (replacing the `{{BASE}}` placeholder). The frontend builds every API/asset/route URL via `withBase()` in `static/js/util.js` — when adding a new fetch, asset `<link>/<script>`, or `history.pushState`/`location.pathname` route check, **always go through `withBase()`** (and add a `{{BASE}}` placeholder for asset refs in `index.html`). Hardcoded absolute paths break the `/music` deployment.
- This app runs behind the **shared Caddy gateway** in `~/IdeaProjects/gateway` (one ngrok domain → many apps by path prefix). Music is registered at `/music` → `127.0.0.1:5300` (route in `gateway/Caddyfile`, `MUSIC_PORT` in `gateway/.env`). This project no longer runs its own nginx/ngrok. After editing the Caddyfile: `pm2 restart caddy-gateway`; after editing gateway `.env`: `pm2 restart ecosystem.config.js --update-env`.
- `app.py` bind host/port come from env: `HOST` (default `127.0.0.1`) and `PORT` (default `8765`). The Dockerfile sets `ENV HOST=0.0.0.0` so the published port is reachable; compose publishes it on host `127.0.0.1:5300`. No source hardcoding — don't reintroduce the old `sed` hack.
- `bin/yt-dlp` is committed to the repo (it's the runtime dependency, not a dev tool).
