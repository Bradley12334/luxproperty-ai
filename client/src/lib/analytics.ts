// ─── Analytics (gtag wrapper) ────────────────────────────────────────────────
// One tiny guarded wrapper around the gtag.js already loaded in client/index.html
// (GA4 G-H5Q3J0G6K8 + Google Ads AW-18290586815). NOT a new dependency — it just
// forwards funnel events to window.gtag when present. Safe pre-consent: with
// analytics_storage:'denied' the event still delivers (cookieless), only storage
// is withheld, exactly like the existing conversion event on the success page.
//
// If gtag is absent (blocker, SSR, preview without the tag) this is a no-op —
// never throws, never blocks the funnel.
export function track(event: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag !== "function") return;
  gtag("event", event, params ?? {});
}
