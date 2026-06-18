// Thin wrappers around the backend HTTP API.

import { withBase } from "./util.js";

export async function apiSearch(q, limit) {
  const params = new URLSearchParams({ q });
  if (limit) params.set("limit", String(limit));
  const r = await fetch(withBase(`/api/search?${params}`));
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "search failed");
  return data;
}

export async function apiDetail(id) {
  const r = await fetch(withBase(`/api/detail?id=${encodeURIComponent(id)}`));
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "không tải được");
  return data;
}

export const videoStreamUrl = (id, itag) =>
  withBase(`/api/stream_video?id=${encodeURIComponent(id)}${itag ? `&itag=${encodeURIComponent(itag)}` : ""}`);
