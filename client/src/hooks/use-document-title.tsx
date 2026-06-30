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
    const prevDesc = metaDesc?.getAttribute("content") ?? "";
    const activeDesc = description || DEFAULT_DESCRIPTION;
    if (metaDesc) metaDesc.setAttribute("content", activeDesc);

    // ── Canonical ──────────────────────────────────────────────────────────
    // Build canonical from current pathname (no hash, no query)
    const canonicalPath = window.location.pathname.replace(/\/$/, "") || "/";
    const canonicalUrl = `${BASE_URL}${canonicalPath}`;

    let canonicalEl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const prevCanonical = canonicalEl?.getAttribute("href") ?? "";
    if (!canonicalEl) {
      canonicalEl = document.createElement("link");
      canonicalEl.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute("href", canonicalUrl);

    // ── Open Graph ─────────────────────────────────────────────────────────
    function setMeta(selector: string, value: string): string {
      const el = document.querySelector<HTMLMetaElement>(selector);
      const prev = el?.getAttribute("content") ?? "";
      if (el) el.setAttribute("content", value);
      return prev;
    }

    const prevOgTitle    = setMeta('meta[property="og:title"]',       fullTitle);
    const prevOgDesc     = setMeta('meta[property="og:description"]',  activeDesc);
    const prevOgUrl      = setMeta('meta[property="og:url"]',          canonicalUrl);
    const prevTwTitle    = setMeta('meta[name="twitter:title"]',       fullTitle);
    const prevTwDesc     = setMeta('meta[name="twitter:description"]', activeDesc);

    return () => {
      // Restore previous values on unmount so navigating back works correctly
      document.title = prevTitle;
      if (metaDesc) metaDesc.setAttribute("content", prevDesc || DEFAULT_DESCRIPTION);
      if (canonicalEl) canonicalEl.setAttribute("href", prevCanonical || `${BASE_URL}/`);
      setMeta('meta[property="og:title"]',       prevOgTitle);
      setMeta('meta[property="og:description"]',  prevOgDesc);
      setMeta('meta[property="og:url"]',          prevOgUrl);
      setMeta('meta[name="twitter:title"]',       prevTwTitle);
      setMeta('meta[name="twitter:description"]', prevTwDesc);
    };
  }, [title, description]);
}
