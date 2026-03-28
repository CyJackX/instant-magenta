const detailSections = Array.from(document.querySelectorAll("details"));
const SUMMARY_SCROLL_TOP_OFFSET_PX = 10;
const SUMMARY_SCROLL_EASE = 0.1;
const SUMMARY_SCROLL_SETTLE_PX = 1;
const SUMMARY_SCROLL_CHASE_MS = 600;

const pendingVideoHydration = new WeakMap<HTMLDetailsElement, number>();
const activeSummaryChase = new WeakMap<HTMLDetailsElement, number>();

function getHtmlDetailSections(): HTMLDetailsElement[] {
  return detailSections.filter(
    (detail): detail is HTMLDetailsElement => detail instanceof HTMLDetailsElement,
  );
}

function getHashTargetDetail(
  htmlDetailSections: HTMLDetailsElement[],
): HTMLDetailsElement | undefined {
  const targetId = window.location.hash.slice(1);
  if (!targetId) return undefined;

  return htmlDetailSections.find((detail) => detail.id === targetId);
}

function syncHashToDetail(detail: HTMLDetailsElement) {
  if (!detail.id) return;

  const nextHash = `#${detail.id}`;
  if (window.location.hash === nextHash) return;

  window.history.replaceState(null, "", nextHash);
}

function syncOpenDetailWithHash({
  htmlDetailSections,
  allowFallback,
}: {
  htmlDetailSections: HTMLDetailsElement[];
  allowFallback: boolean;
}): HTMLDetailsElement | undefined {
  if (htmlDetailSections.length === 0) return;

  const hashTargetDetail = getHashTargetDetail(htmlDetailSections);
  if (hashTargetDetail) {
    hashTargetDetail.open = true;
    return hashTargetDetail;
  }

  if (!allowFallback) return;

  const hasOpenDetail = htmlDetailSections.some((detail) => detail.open);
  if (hasOpenDetail) return;

  htmlDetailSections[0].open = true;
  return htmlDetailSections[0];
}

function hydrateDetailMedia(detail: HTMLDetailsElement) {
  const images = detail.querySelectorAll("img[data-src]");
  const videos = detail.querySelectorAll("video[data-src]");

  images.forEach((image) => {
    if (!(image instanceof HTMLImageElement)) return;

    if (!image.currentSrc) {
      const src = image.dataset.src;
      if (!src) return;

      image.src = src;
    }
  });

  videos.forEach((video) => {
    if (!(video instanceof HTMLVideoElement)) return;

    const hiddenByClosedAncestor = video.closest("details:not([open])");
    if (hiddenByClosedAncestor) return;

    if (!video.currentSrc) {
      const src = video.dataset.src;
      if (!src) return;

      video.src = src;
      video.load();
    }

    void video.play().catch(() => {});
  });
}

function scheduleDetailVideoHydration(detail: HTMLDetailsElement) {
  const pendingFrame = pendingVideoHydration.get(detail);
  if (pendingFrame) {
    window.cancelAnimationFrame(pendingFrame);
  }

  const frameId = window.requestAnimationFrame(() => {
    pendingVideoHydration.delete(detail);

    if (!detail.open) return;
    hydrateDetailMedia(detail);
  });

  pendingVideoHydration.set(detail, frameId);
}

function pauseDetailVideos(detail: HTMLDetailsElement) {
  const videos = detail.querySelectorAll("video");

  videos.forEach((video) => {
    if (!(video instanceof HTMLVideoElement)) return;
    video.pause();
  });
}

function stopSummaryChase(detail: HTMLDetailsElement) {
  const activeFrame = activeSummaryChase.get(detail);
  if (!activeFrame) return;

  window.cancelAnimationFrame(activeFrame);
  activeSummaryChase.delete(detail);
}

function chaseSummary(detail: HTMLDetailsElement, summary: HTMLElement) {
  stopSummaryChase(detail);

  const endAt = performance.now() + SUMMARY_SCROLL_CHASE_MS;

  const step = () => {
    if (!detail.open) {
      activeSummaryChase.delete(detail);
      return;
    }

    const delta = summary.getBoundingClientRect().top - SUMMARY_SCROLL_TOP_OFFSET_PX;
    if (Math.abs(delta) > SUMMARY_SCROLL_SETTLE_PX) {
      const scrollDelta = delta * SUMMARY_SCROLL_EASE;
      window.scrollBy(0, scrollDelta);
    }

    const shouldContinue = performance.now() < endAt;

    if (!shouldContinue) {
      activeSummaryChase.delete(detail);
      return;
    }

    activeSummaryChase.set(detail, window.requestAnimationFrame(step));
  };

  activeSummaryChase.set(detail, window.requestAnimationFrame(step));
}

export function initIndexPage() {
  const htmlDetailSections = getHtmlDetailSections();
  const initialHashTarget = getHashTargetDetail(htmlDetailSections);

  const initiallyOpenedDetail = syncOpenDetailWithHash({
    htmlDetailSections,
    allowFallback: true,
  });
  const suppressInitialSummaryChase = !initialHashTarget
    ? initiallyOpenedDetail
    : undefined;

  htmlDetailSections.forEach((detail) => {
    if (detail.open) {
      scheduleDetailVideoHydration(detail);
    }
  });

  htmlDetailSections.forEach((detail) => {
    detail.addEventListener("toggle", () => {
      if (!detail.open) {
        const pendingFrame = pendingVideoHydration.get(detail);
        if (pendingFrame) {
          window.cancelAnimationFrame(pendingFrame);
          pendingVideoHydration.delete(detail);
        }

        stopSummaryChase(detail);
        pauseDetailVideos(detail);
        return;
      }

      scheduleDetailVideoHydration(detail);
      syncHashToDetail(detail);

      const summary = detail.querySelector(":scope > summary");
      if (!(summary instanceof HTMLElement)) return;
      if (detail === suppressInitialSummaryChase) return;

      chaseSummary(detail, summary);
    });
  });

  window.addEventListener("hashchange", () => {
    syncOpenDetailWithHash({ htmlDetailSections, allowFallback: false });
  });
}
