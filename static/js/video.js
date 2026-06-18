// Video element: inline-in-detail, auto-shrink mini on scroll, floating PiP popup, OS PiP awareness.

import {
  videoPip, videoEl, videoTitle, videoClose, videoPop,
  videoLoading, videoHeader, videoResize, videoMiniHost, videoMiniClose, detailEl,
} from "./dom.js";
import { loaderHTML } from "./util.js";
import { videoStreamUrl } from "./api.js";
import { pushHistoryItem } from "./state.js";
import { renderHistory } from "./panels.js";
import { mountControls, unmountControls } from "./controls.js";
import { playNext } from "./queue.js";

let currentVideoItem = null;
let inlineMediaEl = null;  // Currently the .detail-thumb or .thumb that hosts the inline <video>.
let currentFormats = [];   // Danh sách chất lượng progressive mp4 của video đang xem (cho menu quality).

// pages.js gọi trước khi mở player để menu chất lượng có dữ liệu.
export function setPlayerFormats(formats) {
  currentFormats = Array.isArray(formats) ? formats : [];
}

export function moveVideoTo(container) {
  if (!container || videoEl.parentElement === container) return;
  if (container === videoPip) {
    container.insertBefore(videoEl, videoResize);
  } else {
    container.appendChild(videoEl);
  }
}

function logHistory(item) {
  if (pushHistoryItem(item)) renderHistory();
}

function ensureLoaderIn(hostEl) {
  if (!hostEl) return;
  if (!hostEl.querySelector(":scope > .video-loader")) {
    const loader = document.createElement("div");
    loader.className = "video-loader";
    loader.setAttribute("aria-label", "Đang tải video");
    hostEl.appendChild(loader);
  }
}

export function playInline(item, hostEl) {
  // hostEl can be a card .thumb or the #detail-media .detail-thumb — both styled to host the singleton <video>.
  if (!hostEl) { openVideo(item); return; }
  if (inlineMediaEl && inlineMediaEl !== hostEl) {
    inlineMediaEl.classList.remove("playing", "loading");
  }
  currentVideoItem = item;
  inlineMediaEl = hostEl;
  videoTitle.textContent = item.title || "Video";
  videoMiniHost.classList.add("hidden");
  videoPip.classList.add("hidden");
  videoPip.setAttribute("aria-hidden", "true");
  ensureLoaderIn(hostEl);
  moveVideoTo(hostEl);
  hostEl.classList.add("playing");
  hostEl.classList.add("loading");
  videoEl.classList.remove("hidden");
  const wantedSrc = videoStreamUrl(item.id);
  if (videoEl.src !== wantedSrc) videoEl.src = wantedSrc;
  // Thanh điều khiển đầy đủ (tua/next/quality...) chỉ gắn cho player chính ở trang xem.
  if (hostEl.id === "detail-media") mountControls(hostEl, { item, formats: currentFormats });
  videoEl.play().catch((e) => console.warn("video autoplay blocked", e));
  logHistory(item);
}

export function openVideoInline(item) {
  const media = document.getElementById("detail-media");
  playInline(item, media);
}

export function openVideo(item) {
  // Floating PiP popup — used when no detail page is available.
  currentVideoItem = item;
  videoTitle.textContent = item.title || "Video";
  moveVideoTo(videoPip);
  videoEl.classList.add("hidden");
  videoLoading.innerHTML = loaderHTML("Đang lấy video...");
  videoLoading.classList.remove("hidden");
  videoPip.classList.remove("hidden");
  videoPip.setAttribute("aria-hidden", "false");
  videoMiniHost.classList.add("hidden");
  videoEl.src = videoStreamUrl(item.id);
  videoEl.play().catch((e) => console.warn("video autoplay blocked", e));
  logHistory(item);
}

export function closeVideo() {
  if (document.pictureInPictureElement === videoEl) {
    document.exitPictureInPicture().catch(() => {});
  }
  videoEl.pause();
  videoEl.removeAttribute("src");
  videoEl.load();
  videoPip.classList.add("hidden");
  videoPip.setAttribute("aria-hidden", "true");
  videoMiniHost.classList.add("hidden");
  videoLoading.classList.add("hidden");
  videoEl.classList.add("hidden");
  if (inlineMediaEl) inlineMediaEl.classList.remove("playing");
  unmountControls();
  inlineMediaEl = null;
  currentVideoItem = null;
}

export function preserveInlineVideoBeforeTeardown() {
  if (!inlineMediaEl) return;
  if (detailEl.contains(videoEl) && currentVideoItem) {
    moveVideoTo(videoPip);
    videoPip.classList.remove("hidden");
    videoPip.setAttribute("aria-hidden", "false");
  }
  inlineMediaEl = null;
}

// Called when leaving the Home stack — fully stop inline playback so it doesn't pop up as mini on another tab.
export function stopInlineVideo() {
  if (!inlineMediaEl) return;
  if (inlineMediaEl.classList.contains("playing")) inlineMediaEl.classList.remove("playing");
  videoEl.pause();
  videoEl.removeAttribute("src");
  videoEl.load();
  videoMiniHost.classList.add("hidden");
  inlineMediaEl = null;
  currentVideoItem = null;
}

function updateVideoMini() {
  if (!inlineMediaEl || !document.contains(inlineMediaEl)) return;
  if (videoEl.paused && videoEl.readyState < 2) return;
  const rect = inlineMediaEl.getBoundingClientRect();
  const outOfView = rect.bottom < 60;
  const inMini = videoEl.parentElement === videoMiniHost;
  if (outOfView && !inMini) {
    moveVideoTo(videoMiniHost);
    videoMiniHost.classList.remove("hidden");
  } else if (!outOfView && inMini) {
    moveVideoTo(inlineMediaEl);
    videoMiniHost.classList.add("hidden");
  }
}

// Custom tap-to-toggle play/pause since native controls are hidden everywhere.
function toggleSingletonPlayback() {
  if (!videoEl.src) return;
  if (videoEl.paused) videoEl.play().catch((e) => console.warn("play failed:", e));
  else videoEl.pause();
}

export function attachVideoEvents() {
  videoEl.addEventListener("click", toggleSingletonPlayback);
  // Hết bài → tự phát bài tiếp theo trong hàng đợi (chỉ khi đang ở player chính trang xem).
  videoEl.addEventListener("ended", () => {
    if (inlineMediaEl && inlineMediaEl.id === "detail-media") playNext();
  });
  // Listen on the home stack body which is the scrollable parent of detail.
  document.querySelectorAll(".stack-body").forEach((el) => el.addEventListener("scroll", updateVideoMini, { passive: true }));
  window.addEventListener("scroll", updateVideoMini, { passive: true });
  window.addEventListener("resize", updateVideoMini);

  videoMiniClose.onclick = closeVideo;
  videoClose.onclick = closeVideo;

  videoPop.onclick = async () => {
    try {
      if (document.pictureInPictureElement === videoEl) {
        await document.exitPictureInPicture();
      } else {
        await videoEl.requestPictureInPicture();
      }
    } catch (err) { console.warn("PIP not available:", err); }
  };

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !videoPip.classList.contains("hidden")) closeVideo();
  });

  videoEl.addEventListener("enterpictureinpicture", () => document.body.classList.add("os-pip-active"));
  videoEl.addEventListener("leavepictureinpicture", () => document.body.classList.remove("os-pip-active"));
  videoEl.addEventListener("loadeddata", () => {
    videoLoading.classList.add("hidden");
    videoEl.classList.remove("hidden");
  });
  videoEl.addEventListener("playing", () => inlineMediaEl?.classList.remove("loading"));
  videoEl.addEventListener("waiting", () => inlineMediaEl?.classList.add("loading"));
  videoEl.addEventListener("error", () => {
    inlineMediaEl?.classList.remove("loading");
    videoLoading.innerHTML = `<div class="error-inline">Lỗi tải video. Thử lại sau.</div>`;
    videoLoading.classList.remove("hidden");
  });

  (function makeDraggable() {
    let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
    videoHeader.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON") return;
      const rect = videoPip.getBoundingClientRect();
      videoPip.style.right = "auto"; videoPip.style.bottom = "auto";
      videoPip.style.left = rect.left + "px"; videoPip.style.top = rect.top + "px";
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      startLeft = rect.left; startTop = rect.top;
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      const w = videoPip.offsetWidth, h = videoPip.offsetHeight;
      const left = Math.max(0, Math.min(window.innerWidth - w, startLeft + dx));
      const top = Math.max(0, Math.min(window.innerHeight - h, startTop + dy));
      videoPip.style.left = left + "px"; videoPip.style.top = top + "px";
    });
    document.addEventListener("mouseup", () => { dragging = false; });
  })();

  (function makeResizable() {
    let resizing = false, startX = 0, startW = 0;
    videoResize.addEventListener("mousedown", (e) => {
      resizing = true; startX = e.clientX; startW = videoPip.offsetWidth;
      e.preventDefault(); e.stopPropagation();
    });
    document.addEventListener("mousemove", (e) => {
      if (!resizing) return;
      const w = Math.max(240, Math.min(window.innerWidth - 32, startW + (e.clientX - startX)));
      videoPip.style.width = w + "px";
    });
    document.addEventListener("mouseup", () => { resizing = false; });
  })();
}
