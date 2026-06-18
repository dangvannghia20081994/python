// Shorts stack: vertical scroll-snap feed with its own search.

import { $ } from "./dom.js";
import { escapeHtml, loaderHTML, normalizeQuery, withBase } from "./util.js";
import { videoStreamUrl } from "./api.js";
import { openPlPopover } from "./panels.js";
import { pushHistoryItem } from "./state.js";
import { renderHistory } from "./panels.js";

const FALLBACK_QUERY = "#shorts";
const SHORTS_PAGE_SIZE = 30;
const SHORTS_MAX = 120; // matches backend cap on /api/shorts
let observer = null;
let loadMoreObserver = null;
// Always start muted on each page load — browsers only allow unmuted autoplay after a user gesture
// inside the current document. Persisting "unmuted" across reloads causes play() to be blocked → frozen poster.
let currentMuted = true;
let lastQuery = FALLBACK_QUERY;
let hasLoaded = false;
let shortsCtx = null; // { q, limit, ids: Set<string>, loading: bool, done: bool }

function applyMuted(muted) {
  currentMuted = muted;
  document.querySelectorAll(".short-video").forEach((v) => (v.muted = muted));
  document.querySelectorAll('[data-act="mute"]').forEach((b) => (b.textContent = muted ? "🔇" : "🔊"));
  document.querySelectorAll(".short-unmute-hint").forEach((h) => h.classList.toggle("hidden", !muted));
}

function safePlay(video) {
  // Always try muted first to satisfy autoplay policy; tap-to-unmute handles sound.
  if (!video.muted && currentMuted) video.muted = true;
  return video.play().catch((err) => {
    // If even muted play fails, the user hasn't interacted yet — force-mute then retry once.
    if (!video.muted) {
      video.muted = true;
      return video.play().catch((err2) => console.warn("short play blocked:", err2));
    }
    console.warn("short play blocked:", err);
  });
}

function buildSlide(it) {
  const slide = document.createElement("div");
  slide.className = "short-slide";
  slide.dataset.id = it.id;
  slide.innerHTML = `
    <video class="short-video" loop playsinline preload="metadata" ${currentMuted ? "muted" : ""}
           poster="${it.thumbnail || ""}"></video>
    <button class="short-unmute-hint ${currentMuted ? "" : "hidden"}" type="button" aria-label="Bật tiếng">
      <span>🔇 Chạm để bật tiếng</span>
    </button>
    <div class="short-overlay">
      <div class="short-meta">
        <div class="short-title">${escapeHtml(it.title || "")}</div>
        <div class="short-uploader">@${escapeHtml(it.uploader || "")}</div>
      </div>
    </div>
    <div class="short-actions">
      <button data-act="mute" title="Bật/tắt tiếng">${currentMuted ? "🔇" : "🔊"}</button>
      <button data-act="playlist" title="+ Playlist">⊕</button>
    </div>`;
  const video = slide.querySelector(".short-video");
  slide._item = it;
  // Tap on video: if muted → unmute (browser autoplay-with-sound becomes allowed after this gesture).
  // Otherwise toggle play/pause. Always retry play to recover from any blocked initial autoplay.
  video.addEventListener("click", () => {
    if (!video.src) video.src = videoStreamUrl(slide._item.id);
    if (video.muted) {
      applyMuted(false);
      video.play().catch((e) => console.warn("unmute play failed:", e));
    } else if (video.paused) {
      video.play().catch((e) => console.warn("play failed:", e));
    } else {
      video.pause();
    }
  });
  slide.querySelector(".short-unmute-hint").onclick = (e) => {
    e.stopPropagation();
    if (!video.src) video.src = videoStreamUrl(slide._item.id);
    applyMuted(false);
    video.play().catch((err) => console.warn("hint unmute failed:", err));
  };
  slide.querySelector('[data-act="mute"]').onclick = (e) => {
    e.stopPropagation();
    if (!video.src) video.src = videoStreamUrl(slide._item.id);
    applyMuted(!currentMuted);
    video.play().catch((err) => console.warn("toggle mute play failed:", err));
  };
  slide.querySelector('[data-act="playlist"]').onclick = (e) => { e.stopPropagation(); openPlPopover(e.currentTarget, it); };
  return slide;
}

function setupObserver(feed) {
  if (observer) observer.disconnect();
  observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const slide = e.target;
      const video = slide.querySelector(".short-video");
      if (!video) continue;
      if (e.intersectionRatio > 0.6) {
        if (!video.src) video.src = videoStreamUrl(slide._item.id);
        video.muted = currentMuted;
        safePlay(video);
        if (pushHistoryItem(slide._item)) renderHistory();
      } else {
        video.pause();
      }
    }
  }, { root: feed.parentElement, threshold: [0, 0.25, 0.6, 1] });
  document.querySelectorAll(".short-slide").forEach((s) => observer.observe(s));
}

async function loadShortsFeed(q = FALLBACK_QUERY, limit = SHORTS_PAGE_SIZE) {
  const r = await fetch(withBase(`/api/shorts?q=${encodeURIComponent(q)}&limit=${limit}`));
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "shorts failed");
  return data;
}

function setupLoadMoreObserver(feed) {
  if (loadMoreObserver) loadMoreObserver.disconnect();
  // Trigger when the slide *before* the last one comes into view → prefetch before user hits the end.
  loadMoreObserver = new IntersectionObserver(
    (entries) => { for (const e of entries) if (e.isIntersecting) loadMoreShorts(); },
    { root: feed, threshold: 0.5 },
  );
  const slides = feed.querySelectorAll(".short-slide");
  if (!slides.length) return;
  const target = slides[Math.max(0, slides.length - 2)];
  loadMoreObserver.observe(target);
}

function showShortsLoader(feed) {
  const host = feed.parentElement;
  if (!host || host.querySelector(".shorts-load-more")) return;
  const el = document.createElement("div");
  el.className = "shorts-load-more";
  el.innerHTML = `<div class="load-more-spinner" aria-label="Đang tải thêm"></div>`;
  host.appendChild(el);
}

function hideShortsLoader(feed) {
  const host = feed.parentElement;
  host?.querySelector(".shorts-load-more")?.remove();
}

async function loadMoreShorts() {
  if (!shortsCtx || shortsCtx.loading || shortsCtx.done) return;
  shortsCtx.loading = true;
  const feed = $("shorts-feed");
  // Backend caps at 60; if we're already there, just stop.
  if (shortsCtx.limit >= SHORTS_MAX) { shortsCtx.done = true; shortsCtx.loading = false; return; }
  const newLimit = Math.min(SHORTS_MAX, shortsCtx.limit + SHORTS_PAGE_SIZE);
  showShortsLoader(feed);
  try {
    const data = await loadShortsFeed(shortsCtx.q, newLimit);
    const items = data.items || [];
    const newOnes = items.filter((it) => it.id && !shortsCtx.ids.has(it.id));
    let added = 0;
    for (const it of newOnes) {
      shortsCtx.ids.add(it.id);
      feed.appendChild(buildSlide(it));
      added++;
    }
    shortsCtx.limit = data.limit || newLimit;
    if (added > 0) {
      setupObserver(feed);             // re-observe all slides for autoplay
      setupLoadMoreObserver(feed);     // re-arm load-more on the new penultimate slide
    } else {
      shortsCtx.done = true;
      loadMoreObserver?.disconnect();
    }
  } catch (err) {
    console.warn("load more shorts failed:", err);
  } finally {
    hideShortsLoader(feed);
    shortsCtx.loading = false;
  }
}

async function refreshShorts(q = FALLBACK_QUERY) {
  const feed = $("shorts-feed");
  lastQuery = q;
  feed.innerHTML = `<div class="shorts-loading">${loaderHTML("Đang tải Shorts...")}</div>`;
  loadMoreObserver?.disconnect();
  try {
    const data = await loadShortsFeed(q, SHORTS_PAGE_SIZE);
    const items = data.items || [];
    if (items.length === 0) {
      feed.innerHTML = `<div class="shorts-empty">Không có Shorts phù hợp với "${escapeHtml(q)}".</div>`;
      shortsCtx = null;
      return;
    }
    feed.innerHTML = "";
    for (const it of items) feed.appendChild(buildSlide(it));
    setupObserver(feed);
    shortsCtx = {
      q,
      limit: data.limit || SHORTS_PAGE_SIZE,
      ids: new Set(items.map((it) => it.id).filter(Boolean)),
      loading: false,
      done: (data.limit || SHORTS_PAGE_SIZE) >= SHORTS_MAX,
    };
    if (!shortsCtx.done) setupLoadMoreObserver(feed);
    hasLoaded = true;
  } catch (err) {
    feed.innerHTML = `<div class="shorts-empty">Lỗi: ${escapeHtml(err.message)}</div>`;
  }
}

export function pauseAllShorts() {
  document.querySelectorAll(".short-video").forEach((v) => v.pause());
}

export function ensureShortsLoaded() {
  if (!hasLoaded) refreshShorts(FALLBACK_QUERY);
}

export function attachShorts() {
  const form = $("search-form-shorts");
  if (!form) return;
  const qInput = form.querySelector(".q-input");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = normalizeQuery(qInput.value) || FALLBACK_QUERY;
    qInput.value = q === FALLBACK_QUERY ? "" : q;
    refreshShorts(q);
  });
}
