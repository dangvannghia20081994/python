// Home stack: search results, suggestions, detail view.

import { $, results, detailEl, heroEl, resultsHeaderEl } from "./dom.js";
import { playHistory } from "./state.js";
import { escapeHtml, fmtDur, fmtViews, fmtUploadDate, normalizeQuery, loaderHTML, withBase } from "./util.js";
import { apiSearch, apiDetail } from "./api.js";
import { openVideoInline, playInline, preserveInlineVideoBeforeTeardown, setPlayerFormats } from "./video.js";
import { openPlPopover } from "./panels.js";
import { setQueue, syncQueueIndex, setQueueNavHandler } from "./queue.js";

const FALLBACK_QUERY = "nhạc remix tiktok";
const detailCache = new Map();
const SEARCH_PAGE_SIZE = 15;
let searchCtx = null; // { q, limit, ids: Set<string>, loading: bool }

// IntersectionObserver fires loadMoreResults when the sentinel row scrolls into view.
// rootMargin lets us start fetching slightly before it hits the viewport for a smoother feel.
const loadMoreObserver = new IntersectionObserver(
  (entries) => { for (const e of entries) if (e.isIntersecting) loadMoreResults(); },
  { rootMargin: "300px 0px" },
);

function buildResultCard(it) {
  const card = document.createElement("div");
  card.className = "card";
  const dur = it.duration ? fmtDur(it.duration) : "";
  card.innerHTML = `
    <div class="thumb">
      <img src="${it.thumbnail || ""}" alt="" loading="lazy">
      <button class="thumb-play" title="Xem video"><span class="thumb-play-icon">▶</span></button>
      ${dur ? `<div class="duration-badge">${dur}</div>` : ""}
    </div>
    <div class="meta">
      <a class="title" href="${withBase(`/watch?id=${encodeURIComponent(it.id)}`)}" data-act="detail" title="Xem video">${escapeHtml(it.title || "(không tiêu đề)")}</a>
      <div class="uploader">${escapeHtml(it.uploader || "")}</div>
    </div>
    <div class="actions">
      <button data-act="playlist" title="Thêm vào playlist">+ Playlist</button>
    </div>`;
  const thumbEl = card.querySelector(".thumb");
  const playInThis = (e) => { e?.stopPropagation?.(); playInline(it, thumbEl); };
  // Click thumb (img or ▶ overlay) → play inline in this card. Click title → open detail page.
  card.querySelector(".thumb-play").onclick = playInThis;
  card.querySelector(".thumb img").onclick = playInThis;
  card.querySelector('[data-act="detail"]').onclick = (e) => { e.preventDefault(); navigateToDetail(it); };
  card.querySelector('[data-act="playlist"]').onclick = (e) => { e.stopPropagation(); openPlPopover(e.currentTarget, it); };
  return card;
}

function appendLoadMoreSentinel() {
  const row = document.createElement("div");
  row.className = "load-more-row";
  row.innerHTML = `<div class="load-more-spinner" aria-label="Đang tải thêm"></div>`;
  results.appendChild(row);
  loadMoreObserver.observe(row);
}

function removeLoadMoreSentinel() {
  const row = results.querySelector(".load-more-row");
  if (!row) return;
  loadMoreObserver.unobserve(row);
  row.remove();
}

async function loadMoreResults() {
  if (!searchCtx || searchCtx.loading) return;
  searchCtx.loading = true;
  const newLimit = searchCtx.limit + SEARCH_PAGE_SIZE;
  try {
    const data = await apiSearch(searchCtx.q, newLimit);
    const all = data.items || [];
    const newOnes = all.filter((it) => it.id && !searchCtx.ids.has(it.id));
    removeLoadMoreSentinel();
    for (const it of newOnes) {
      searchCtx.ids.add(it.id);
      results.appendChild(buildResultCard(it));
    }
    searchCtx.limit = newLimit;
    // Re-show sentinel only if backend still has more to give (we got a full page back).
    if (newOnes.length > 0 && all.length >= newLimit) appendLoadMoreSentinel();
  } catch (err) {
    console.warn("load more failed:", err);
  } finally {
    searchCtx.loading = false;
  }
}

export function renderResults(items, opts = {}) {
  results.innerHTML = "";
  if (!items.length) {
    results.innerHTML = `<div class="loading">Không có kết quả.</div>`;
    searchCtx = null;
    return;
  }
  for (const it of items) results.appendChild(buildResultCard(it));
  if (opts.canLoadMore) {
    searchCtx = {
      q: opts.q,
      limit: opts.limit,
      ids: new Set(items.map((it) => it.id).filter(Boolean)),
      loading: false,
    };
    // hasMore is driven by backend's raw count (passed via opts.hasMore), not the post-filter render count —
    // otherwise dropping a seed item in suggestions hides the sentinel even when more results exist.
    if (opts.hasMore) appendLoadMoreSentinel();
  } else {
    searchCtx = null;
  }
}

export function showSkeleton(count = 8) {
  results.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const s = document.createElement("div");
    s.className = "skel-card";
    s.innerHTML = `
      <div class="skel-thumb"></div>
      <div class="skel-meta">
        <div class="skel-line"></div>
        <div class="skel-line short"></div>
      </div>`;
    results.appendChild(s);
  }
}

function hideSuggestionsHeader() {
  resultsHeaderEl.classList.add("hidden");
  heroEl.classList.add("hidden");
}
function showHero() { heroEl.classList.remove("hidden"); }

function pickSeed() {
  if (playHistory.length > 0) return { item: playHistory[0], reason: "xem gần nhất" };
  return null;
}

export async function loadSuggestions() {
  detailEl.classList.add("hidden");
  detailEl.innerHTML = "";
  results.classList.remove("hidden");
  const seed = pickSeed();
  const q = normalizeQuery(seed ? seed.item.title : FALLBACK_QUERY);
  resultsHeaderEl.querySelector("#results-header-text").innerHTML = seed
    ? `Gợi ý theo bài ${escapeHtml(seed.reason)}: <b>${escapeHtml(seed.item.title || "")}</b>`
    : `Gợi ý: <b>${escapeHtml(FALLBACK_QUERY)}</b>`;
  resultsHeaderEl.classList.remove("hidden");
  showHero();
  showSkeleton();
  try {
    const data = await apiSearch(q, SEARCH_PAGE_SIZE);
    const raw = data.items || [];
    const items = raw.filter((it) => !seed || it.id !== seed.item.id);
    const limit = data.limit || SEARCH_PAGE_SIZE;
    renderResults(items, { canLoadMore: true, q, limit, hasMore: raw.length >= limit });
  } catch (err) {
    results.innerHTML = `<div class="error">Lỗi tải gợi ý: ${escapeHtml(err.message)}</div>`;
  }
}

export function attachHomeSearch() {
  const form = $("search-form-home");
  if (!form) return;
  const qInput = form.querySelector(".q-input");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = normalizeQuery(qInput.value);
    qInput.value = q;
    if (!q) return;
    if (location.pathname !== withBase("/")) window.history.pushState({ view: "home" }, "", withBase("/"));
    detailEl.classList.add("hidden");
    detailEl.innerHTML = "";
    results.classList.remove("hidden");
    hideSuggestionsHeader();
    showSkeleton();
    try {
      const data = await apiSearch(q, SEARCH_PAGE_SIZE);
      const raw = data.items || [];
      const limit = data.limit || SEARCH_PAGE_SIZE;
      renderResults(raw, { canLoadMore: true, q, limit, hasMore: raw.length >= limit });
    } catch (err) {
      results.innerHTML = `<div class="error">Lỗi: ${escapeHtml(err.message)}</div>`;
    }
  });
  $("results-refresh").onclick = loadSuggestions;
}

function showDetailView() {
  detailEl.classList.remove("hidden");
  heroEl.classList.add("hidden");
  resultsHeaderEl.classList.add("hidden");
  results.classList.add("hidden");
}

export function showListView() {
  detailEl.classList.add("hidden");
  preserveInlineVideoBeforeTeardown();
  detailEl.innerHTML = "";
  results.classList.remove("hidden");
}

function renderDetail(info, related) {
  const dur = info.duration ? fmtDur(info.duration) : "";
  const views = info.view_count ? `${fmtViews(info.view_count)} lượt xem` : "";
  const date = fmtUploadDate(info.upload_date);
  const desc = (info.description || "").trim();
  detailEl.innerHTML = `
    <div class="detail-card">
      <button class="detail-back" id="detail-back-btn" title="Quay lại">← Quay lại</button>
      <div class="detail-hero">
        <div class="detail-thumb" id="detail-media">
          <img src="${info.thumbnail || ""}" alt="">
          <button class="detail-play-overlay" id="detail-play-btn" title="Xem video">
            <span class="thumb-play-icon">▶</span>
          </button>
          ${dur ? `<div class="duration-badge">${dur}</div>` : ""}
        </div>
        <div class="detail-info">
          <h2 class="detail-title">${escapeHtml(info.title || "")}</h2>
          <div class="detail-uploader">${escapeHtml(info.uploader || "")}</div>
          <div class="detail-stats">
            ${views ? `<span>👁 ${escapeHtml(views)}</span>` : ""}
            ${date ? `<span>📅 ${escapeHtml(date)}</span>` : ""}
            ${dur ? `<span>⏱ ${escapeHtml(dur)}</span>` : ""}
          </div>
          <div class="detail-actions">
            <button class="detail-action" data-act="playlist">+ Playlist</button>
          </div>
        </div>
      </div>
      ${desc ? `<div class="detail-desc"><div class="detail-section-title">Mô tả</div><pre>${escapeHtml(desc)}</pre></div>` : ""}
      <div class="detail-related">
        <div class="detail-section-title">Gợi ý tiếp theo</div>
        <div class="detail-related-grid"></div>
      </div>
    </div>`;
  const item = {
    id: info.id, title: info.title, uploader: info.uploader,
    duration: info.duration, thumbnail: info.thumbnail,
  };
  detailEl.querySelector("#detail-back-btn").onclick = () => window.history.back();
  detailEl.querySelector("#detail-play-btn").onclick = () => openVideoInline(item);
  detailEl.querySelector('[data-act="playlist"]').onclick = (e) => openPlPopover(e.currentTarget, item);

  const grid = detailEl.querySelector(".detail-related-grid");
  if (related && related.length) {
    for (const r of related) {
      const rdur = r.duration ? fmtDur(r.duration) : "";
      const row = document.createElement("div");
      row.className = "related-row";
      row.innerHTML = `
        <div class="related-thumb">
          <img src="${r.thumbnail || ""}" alt="" loading="lazy">
          ${rdur ? `<span class="related-dur">${rdur}</span>` : ""}
        </div>
        <div class="related-meta">
          <a class="related-title" href="${withBase(`/watch?id=${encodeURIComponent(r.id)}`)}">${escapeHtml(r.title || "")}</a>
          <div class="related-uploader">${escapeHtml(r.uploader || "")}</div>
        </div>
        <button class="related-play" title="Xem video">▶</button>`;
      const goDetail = (e) => { e?.preventDefault?.(); navigateToDetail(r); };
      row.querySelector(".related-title").onclick = goDetail;
      row.querySelector(".related-thumb").onclick = goDetail;
      row.querySelector(".related-play").onclick = goDetail;
      grid.appendChild(row);
    }
  } else {
    grid.innerHTML = `<div class="panel-empty">Chưa có gợi ý.</div>`;
  }
}

export async function loadDetailById(id, opts = {}) {
  preserveInlineVideoBeforeTeardown();
  showDetailView();
  detailEl.innerHTML = `<div class="loading">${loaderHTML("Đang tải chi tiết...")}</div>`;
  let data;
  if (detailCache.has(id)) {
    data = detailCache.get(id);
  } else {
    try {
      data = await apiDetail(id);
      detailCache.set(id, data);
    } catch (err) {
      detailEl.innerHTML = `<div class="error">Lỗi tải chi tiết: ${escapeHtml(err.message)}</div>`;
      return;
    }
  }
  renderDetail(data.info, data.related || []);
  setPlayerFormats(data.info.formats || []);
  const mainItem = {
    id: data.info.id, title: data.info.title, uploader: data.info.uploader,
    duration: data.info.duration, thumbnail: data.info.thumbnail,
  };
  // Đi Trước/Tiếp (keepQueue) → giữ nguyên hàng đợi cũ, chỉ cập nhật vị trí; còn lại dựng hàng đợi mới.
  if (opts.keepQueue) syncQueueIndex(id);
  else setQueue([mainItem, ...(data.related || [])], 0);
  if (opts.autoplay) openVideoInline(mainItem);
}

export function navigateToDetail(item, opts = {}) {
  const url = withBase(`/watch?id=${encodeURIComponent(item.id)}`);
  window.history.pushState({ view: "detail", id: item.id }, "", url);
  document.title = `${item.title || "Detail"} — Lucy Music`;
  loadDetailById(item.id, opts);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// queue.js gọi lại hàm này khi bấm Trước/Tiếp hoặc autoplay hết bài.
setQueueNavHandler(navigateToDetail);

export function navigateToHome(push = false) {
  if (push) window.history.pushState({ view: "home" }, "", withBase("/"));
  showListView();
  loadSuggestions();
}
