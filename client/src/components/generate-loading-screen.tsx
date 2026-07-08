/**
 * GenerateLoadingScreen
 * ─────────────────────
 * Full-screen loading state shown ONLY while a brief is generating (rendered by
 * the home page when the generate mutation is pending). Skeleton layout + a live
 * elapsed timer + simple generic status text, so the user sees the wait is active.
 *
 * Deliberately self-contained and generic: it does NOT hook into the generation
 * pipeline for per-source progress — the status line is a fixed rotating sequence.
 * When the brief is ready the home page navigates away and this unmounts; the
 * finished brief renders exactly as before, unaffected by this component.
 */

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";

// Generic, honest status text — not tied to real per-source events (by design).
const STATUS_STEPS = [
  "Checking official sources…",
  "Pulling HM Land Registry data…",
  "Gathering neighbourhood data…",
  "Compiling your brief…",
];

export function GenerateLoadingScreen() {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const timer = window.setInterval(() => setElapsedMs(performance.now() - start), 100);
    const stepper = window.setInterval(
      () => setStepIdx((i) => (i + 1) % STATUS_STEPS.length),
      2000,
    );
    return () => {
      window.clearInterval(timer);
      window.clearInterval(stepper);
    };
  }, []);

  const secs = (elapsedMs / 1000).toFixed(1);

  return (
    <div className="flex min-h-screen flex-col" data-testid="generate-loading-screen">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-10">
          {/* Heading + status + timer */}
          <div className="text-center py-8 sm:py-10">
            <div className="inline-flex items-center gap-1.5 mb-4" aria-hidden="true">
              <span className="pulse-dot h-2 w-2 rounded-full bg-primary" />
              <span className="pulse-dot h-2 w-2 rounded-full bg-primary" />
              <span className="pulse-dot h-2 w-2 rounded-full bg-primary" />
            </div>
            <h2 className="font-serif text-xl sm:text-2xl tracking-tight mb-2 flex items-center justify-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Compiling your property brief
            </h2>
            <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="text-loading-status">
              {STATUS_STEPS[stepIdx]}{" "}
              <span className="tabular-nums font-mono text-foreground/50">{secs}s</span>
            </p>
          </div>

          {/* Skeleton cards — placeholder layout while the brief builds */}
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-5 sm:p-6 space-y-3">
                <div className="skeleton-shimmer h-5 w-44 max-w-[70%] rounded" />
                <div className="skeleton-shimmer h-4 w-full rounded" />
                <div className="skeleton-shimmer h-4 w-5/6 rounded" />
                <div className="skeleton-shimmer h-4 w-2/3 rounded" />
              </Card>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
