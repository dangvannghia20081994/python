// Pure utility helpers — no DOM, no side effects.

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export function fmtDur(sec) {
  if (!sec && sec !== 0) return "";
  sec = Math.round(sec);
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function fmtRelTime(ts) {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return "vừa xong";
  if (d < 3600) return `${Math.floor(d / 60)} phút trước`;
  if (d < 86400) return `${Math.floor(d / 3600)} giờ trước`;
  return `${Math.floor(d / 86400)} ngày trước`;
}

export function fmtViews(n) {
  if (!n && n !== 0) return "";
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export function fmtUploadDate(s) {
  if (!s || s.length !== 8) return "";
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Chuẩn hoá query tìm kiếm: bỏ whitespace đầu/cuối (gồm cả NBSP, tab, zero-width), gộp nhiều space giữa thành 1.
export function normalizeQuery(s) {
  if (s == null) return "";
  return String(s)
    .replace(/[​-‍﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function loaderHTML(text) {
  const t = text ? `<div class="lucy-loader-text">${escapeHtml(text)}</div>` : "";
  return `<div class="lucy-loader" aria-label="Đang tải"><span></span><span></span><span></span><span></span><span></span></div>${t}`;
}
