import React from "react";
import type { AreaIntelligence } from "@shared/schema";

// Category → icon map (inline SVG paths, no external dependency)
const CATEGORY_ICONS: Record<string, { path: string; label: string }> = {
  transport:   { path: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2h-2m-4 0v4m0 0H8m4 0h4", label: "Transport" },
  noise:       { path: "M15.536 8.464a5 5 0 010 7.072M12 6v12M9.465 9.465a5 5 0 000 5.07", label: "Noise / Air" },
  environment: { path: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z", label: "Environment" },
  schools:     { path: "M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z", label: "Schools" },
  safety:      { path: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", label: "Safety" },
  green:       { path: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z", label: "Green Space" },
  market:      { path: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", label: "Market" },
  amenity:     { path: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", label: "Amenities" },
  value:       { path: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", label: "Value" },
  demand:      { path: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", label: "Demand" },
};

function CategoryIcon({ category }: { category: string }) {
  const icon = CATEGORY_ICONS[category] ?? CATEGORY_ICONS["market"];
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={icon.path} />
    </svg>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  transport:   "Transport",
  noise:       "Noise & Air",
  environment: "Climate",
  schools:     "Schools",
  safety:      "Safety",
  green:       "Green Space",
  market:      "Market",
  amenity:     "Amenities",
  value:       "Value",
  demand:      "Demand",
};

interface Props {
  missedInsights: AreaIntelligence["missedInsights"];
  areaName?: string;
}

export function WhatPeopleMiss({ missedInsights, areaName }: Props) {
  if (!missedInsights || missedInsights.length === 0) return null;

  return (
    <div
      style={{
        background: "#1A1612",
        border: "1px solid #B8860B33",
        borderRadius: "12px",
        padding: "20px 24px",
        marginBottom: "16px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        {/* Eye icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#B8860B"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <div>
          <p
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: "15px",
              color: "#FAF8F4",
              margin: 0,
              lineHeight: 1.2,
              fontWeight: 400,
            }}
          >
            What People Miss About This Area
          </p>
          <p
            style={{
              fontFamily: "'Switzer', 'Helvetica Neue', sans-serif",
              fontSize: "11px",
              color: "#B8860B",
              margin: "2px 0 0",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Non-obvious trade-offs · {missedInsights.length} insight{missedInsights.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          height: "1px",
          background: "linear-gradient(90deg, #B8860B44 0%, #B8860B22 60%, transparent 100%)",
          marginBottom: "16px",
        }}
      />

      {/* Insights */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {missedInsights.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "flex-start",
            }}
          >
            {/* Category chip + icon */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                background: "#B8860B18",
                border: "1px solid #B8860B33",
                borderRadius: "6px",
                padding: "4px 8px",
                flexShrink: 0,
                minWidth: "90px",
                maxWidth: "100px",
              }}
            >
              <span style={{ color: "#B8860B", display: "flex", alignItems: "center" }}>
                <CategoryIcon category={item.category} />
              </span>
              <span
                style={{
                  fontFamily: "'Switzer', 'Helvetica Neue', sans-serif",
                  fontSize: "10px",
                  color: "#B8860B",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                }}
              >
                {CATEGORY_LABELS[item.category] ?? item.category}
              </span>
            </div>

            {/* Insight text */}
            <p
              style={{
                fontFamily: "'Switzer', 'Helvetica Neue', sans-serif",
                fontSize: "13px",
                color: "#D4CFC8",
                margin: 0,
                lineHeight: 1.55,
                fontWeight: 400,
              }}
            >
              {item.insight}
            </p>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p
        style={{
          fontFamily: "'Switzer', 'Helvetica Neue', sans-serif",
          fontSize: "10px",
          color: "#6B6560",
          margin: "14px 0 0",
          letterSpacing: "0.02em",
          lineHeight: 1.4,
        }}
      >
        These insights combine multiple data signals to surface trade-offs that don't appear in listing copy.
      </p>
    </div>
  );
}
