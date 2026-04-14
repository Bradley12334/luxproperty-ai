import { useEffect } from "react";

const SITE_NAME = "LuxProperty.ai";

export function useDocumentTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — UK Property Intelligence. Instantly.`;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
