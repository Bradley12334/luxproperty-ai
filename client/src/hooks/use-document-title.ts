import { useEffect } from "react";

const SITE_NAME = "LuxProperty.ai";
const DEFAULT_DESCRIPTION =
  "AI-powered property intelligence for UK buyers. Enter any postcode or address and get a complete buyer intelligence brief in 60 seconds — built on official HM Land Registry data.";

export function useDocumentTitle(title: string, description?: string) {
  useEffect(() => {
    // --- title ---
    const prevTitle = document.title;
    document.title = title
      ? `${title} — ${SITE_NAME}`
      : `${SITE_NAME} — UK Property Intelligence. Instantly.`;

    // --- description ---
    const metaDesc = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]'
    );
    const prevDesc = metaDesc?.getAttribute("content") ?? "";
    if (metaDesc && description) {
      metaDesc.setAttribute("content", description);
    }

    return () => {
      document.title = prevTitle;
      if (metaDesc && description) {
        metaDesc.setAttribute("content", prevDesc || DEFAULT_DESCRIPTION);
      }
    };
  }, [title, description]);
}
