// Hàng đợi phát: video đang xem + danh sách gợi ý kế tiếp. Dùng cho nút Trước/Tiếp và autoplay khi hết bài.

let queue = [];        // [item, ...] — phần tử 0 là video gốc của trang detail, còn lại là related
let index = 0;         // vị trí video đang phát trong queue
let navHandler = null; // callback điều hướng tới 1 item (pages.navigateToDetail)

// pages.js đăng ký hàm điều hướng để queue khỏi import vòng (queue ↔ pages).
export function setQueueNavHandler(fn) { navHandler = fn; }

// Đặt hàng đợi mới khi mở 1 trang detail "tươi" (click card/related/search).
export function setQueue(items, startIndex = 0) {
  queue = (items || []).filter((it) => it && it.id);
  index = Math.max(0, Math.min(startIndex, queue.length - 1));
}

// Khi đi Trước/Tiếp ta giữ nguyên hàng đợi, chỉ cập nhật lại index theo id đang phát.
export function syncQueueIndex(id) {
  const i = queue.findIndex((it) => it.id === id);
  if (i >= 0) index = i;
}

export const hasNext = () => index >= 0 && index + 1 < queue.length;
export const hasPrev = () => index > 0;
export const nextItem = () => (hasNext() ? queue[index + 1] : null);
export const prevItem = () => (hasPrev() ? queue[index - 1] : null);

export function playNext() {
  const it = nextItem();
  if (!it || !navHandler) return false;
  navHandler(it, { autoplay: true, keepQueue: true });
  return true;
}

export function playPrev() {
  const it = prevItem();
  if (!it || !navHandler) return false;
  navHandler(it, { autoplay: true, keepQueue: true });
  return true;
}
