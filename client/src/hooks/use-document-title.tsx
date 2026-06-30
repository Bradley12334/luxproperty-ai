import { useEffect } from "react";

const SITE_NAME = "LuxProperty.ai";
const BASE_URL = "https://www.luxproperty.ai";
const DEFAULT_DESCRIPTION =
  "AI-powered property intelligence for UK buyers. Enter any postcode or address and get a complete buyer intelligence brief in 60 seconds — built on official HM Land Registry data.";

/**
 * Sets <title>, <meta name="description">, <link rel="canonical">,
 * og:title, og:description, og:url, twitter:title, twitter:description
 * for the current route.
 *
 * The canonical is derived from window.location.pathname so every page
 * gets its own unique canonical URL — fixing the #1 SEO issue where all
 * pages pointed to https://www.luxproperty.ai/ in the static index.html.
 *
 * Cleanup strategy:
 * - Title/description: restore on unmount so navigating away doesn't leave
 *   a stale value momentarily before the next page mounts.
 * - Canonical / og:url: DO NOT restore on unmount. These are URL-based
 *   singletons that the incoming page's effect will immediately own.
 *   Restoring would race-condition them back to "/" before the next
 *   component's effect sets the correct value.
 */
export function useDocumentTitle(title: string, description?: string) {
  useEffect(() => {
    // ── Title ──────────────────────────────────────────────────────────────
    const prevTitle = document.title;
    const fullTitle = title
      ? `${title} — ${SITE_NAME}`
      : `${SITE_NAME} — UK Property Intelligence. Instantly.`;
    document.title = fullTitle;

    // ── Description ────────────────────────────────────────────────────────
    const metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const prevDesc = metaDesc?.getAttribute("content") ?? DEFAULT_DESCRIPTION;
    const activeDesc = description || DEFAULT_DESCRIPTION;
    if (metaDesc) metaDesc.setAttribute("content", activeDesc);

    // ── Canonical ──────────────────────────────────────────────────────────
    // Build canonical from current pathname (strip trailing slash, keep root)
    const canonicalPath = window.location.pathname.replace(/\/+$/, "") || "/";
    const canonicalUrl = `${BASE_URL}${canonicalPath}`;

    let canonicalEl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = document.createElement("link");
      canonicalEl.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute("href", canonicalUrl);

    // ── Open Graph ─────────────────────────────────────────────────────────
    function getMeta(selector: string): HTMLMetaElement | null {
      return document.querySelector<HTMLMetaElement>(selector);
    }

    const ogTitleEl   = getMeta('meta[property="og:title"]');
    const ogDescEl    = getMeta('meta[property="og:description"]');
    const ogUrlEl     = getMeta('meta[property="og:url"]');
    const twTitleEl   = getMeta('meta[name="twitter:title"]');
    const twDescEl    = getMeta('meta[name="twitter:description"]');

    const prevOgTitle  = ogTitleEl?.getAttribute("content")  ?? "";
    const prevOgDesc   = ogDescEl?.getAttribute("content")   ?? "";
    const prevTwTitle  = twTitleEl?.getAttribute("content")  ?? "";
    const prevTwDesc   = twDescEl?.getAttribute("content")   ?? "";

    ogTitleEl?.setAttribute("content", fullTitle);
    ogDescEl?.setAttribute("content", activeDesc);
    ogUrlEl?.setAttribute("content", canonicalUrl);   // url: no cleanup needed
    twTitleEl?.setAttribute("content", fullTitle);
    twDescEl?.setAttribute("content", activeDesc);

    return () => {
      // Restore text-based values so navigating away doesn't flash stale text
      document.title = prevTitle;
      if (metaDesc) metaDesc.setAttribute("content", prevDesc);
      ogTitleEl?.setAttribute("content", prevOgTitle);
      ogDescEl?.setAttribute("content",  prevOgDesc);
      twTitleEl?.setAttribute("content", prevTwTitle);
      twDescEl?.setAttribute("content",  prevTwDesc);
      // Canonical and og:url are NOT restored — the next route owns them.
    };
  }, [title, description]);
}
