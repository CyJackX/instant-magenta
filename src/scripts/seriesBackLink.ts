const HOME_PATHNAME = "/";
const SELECTOR = "[data-series-back-link]";

function cameFromHomePage(): boolean {
  if (!document.referrer) return false;

  try {
    const referrerUrl = new URL(document.referrer);
    return (
      referrerUrl.origin === window.location.origin &&
      referrerUrl.pathname === HOME_PATHNAME
    );
  } catch {
    return false;
  }
}

export function initSeriesBackLink() {
  const link = document.querySelector<HTMLAnchorElement>(SELECTOR);
  if (!link) return;

  link.addEventListener("click", (event) => {
    if (!cameFromHomePage() || window.history.length <= 1) {
      return;
    }

    event.preventDefault();
    window.history.back();
  });
}
