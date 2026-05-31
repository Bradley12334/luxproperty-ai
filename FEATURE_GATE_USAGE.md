# Feature Gate — Usage Guide

## Files added

| File | Purpose |
|---|---|
| `client/src/components/EmailCaptureModal.tsx` | The modal overlay |
| `client/src/components/FeatureGate.tsx` | Gate wrapper + teaser card |
| `email-subscribers-migration.sql` | Supabase table + RLS (already applied) |

---

## Environment variables

The modal uses the **same Supabase client** as the rest of the app.
No new env vars are needed — ensure these are already set in `.env.local`
(for Next.js) or `.env` (for Vite):

```env
# Vite (current stack)
VITE_SUPABASE_URL=https://orriompxdyamnvoahbuq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...

# Next.js (if migrating)
NEXT_PUBLIC_SUPABASE_URL=https://orriompxdyamnvoahbuq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
```

> If you switch to Next.js, replace `import.meta.env.VITE_*` with
> `process.env.NEXT_PUBLIC_*` in `EmailCaptureModal.tsx` (two lines near the top).

---

## Usage examples

### 1. Gate the AI Market Insights section

```tsx
import { FeatureGate } from "@/components/FeatureGate";

<FeatureGate featureName="ai_market_insights">
  <AIMarketInsightsSection postcode={postcode} />
</FeatureGate>
```

### 2. Gate the Investment Score breakdown

```tsx
<FeatureGate featureName="investment_score">
  <InvestmentScoreBreakdown score={score} breakdown={breakdown} />
</FeatureGate>
```

### 3. Gate the Save Property button

```tsx
import { FeatureGate } from "@/components/FeatureGate";

<FeatureGate featureName="save_property">
  <button onClick={() => saveProperty(propertyId)}>
    Save property
  </button>
</FeatureGate>
```

### 4. Gate Price Alerts

```tsx
<FeatureGate featureName="price_alerts">
  <PriceAlertsPanel postcode={postcode} />
</FeatureGate>
```

### 5. Custom headline / subtext for a specific gate

```tsx
<FeatureGate
  featureName="investment_score"
  modalHeadline="See the full investment breakdown"
  modalSubtext="Free access — no credit card, no password."
>
  <InvestmentScoreBreakdown />
</FeatureGate>
```

### 6. Gate a button click (not a content block)

Use the `useEmailCaptured` hook when you need to gate an *action* rather than
rendered content:

```tsx
import { useState } from "react";
import { useEmailCaptured } from "@/components/FeatureGate";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";

function DownloadReportButton({ propertyId }: { propertyId: string }) {
  const { captured, markCaptured } = useEmailCaptured();
  const [showModal, setShowModal] = useState(false);

  const handleClick = () => {
    if (!captured) {
      setShowModal(true);
      return;
    }
    downloadPdf(propertyId);
  };

  return (
    <>
      <button onClick={handleClick}>Download PDF Report</button>

      {showModal && (
        <EmailCaptureModal
          sourceFeature="pdf_download"
          onSuccess={() => {
            markCaptured();
            setShowModal(false);
            downloadPdf(propertyId);
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
```

---

## Checking subscribers (admin)

Because RLS blocks anon SELECT, query subscribers using the **service role key**
(only in server-side code or the Supabase dashboard):

```sql
-- All subscribers, most recent first
SELECT id, email, source_feature, converted, created_at
FROM public.email_subscribers
ORDER BY created_at DESC;

-- Count by feature (conversion attribution)
SELECT source_feature, COUNT(*) as signups
FROM public.email_subscribers
GROUP BY source_feature
ORDER BY signups DESC;

-- Daily signup count (last 30 days)
SELECT DATE(created_at) as day, COUNT(*) as signups
FROM public.email_subscribers
WHERE created_at > now() - interval '30 days'
GROUP BY day
ORDER BY day DESC;
```

---

## Gated features reference

| `featureName` | What it gates |
|---|---|
| `ai_market_insights` | AI Market Insights section |
| `investment_score` | Investment Score breakdown |
| `save_property` | Save Property button |
| `price_alerts` | Price Alerts panel |
| any string | Falls back to a generic teaser card |

To add a new feature, add an entry to `FEATURE_TEASERS` in `FeatureGate.tsx`.

---

## How the gate state works

1. User clicks a gated CTA → `FeatureGate` shows `EmailCaptureModal`
2. User submits email → inserted into `public.email_subscribers`
3. `localStorage.setItem("lux_email_captured", "true")` is set
4. Modal closes → `FeatureGate` re-renders → shows the real feature
5. On next page load: `useState(() => hasEmailCaptured())` initialises as `true`
   → no flash, no modal, feature renders immediately

The gate state survives page reloads. It resets if the user clears localStorage
(they'll just be asked once more — no harm done).
