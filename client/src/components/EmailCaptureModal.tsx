/**
 * EmailCaptureModal.tsx
 * ─────────────────────
 * Luxury-aesthetic email capture modal for LuxProperty.ai.
 *
 * Design tokens (matching the existing site):
 *   Charcoal  #1A1612   Background
 *   Gold      #B8860B   Accent / CTA
 *   Cream     #FAF8F4   Text / surface
 *   Muted     #9A9490   Secondary text
 *   Border    #2A2420   Card border
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Mail, ArrowRight, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────
type ModalStatus = "idle" | "loading" | "success" | "error";

export interface EmailCaptureModalProps {
  /** Which feature triggered the modal — stored in Supabase for attribution */
  sourceFeature: string;
  /** Called when the user successfully submits their email */
  onSuccess: () => void;
  /** Called when the user explicitly closes the modal without submitting */
  onClose: () => void;
  /** Optional custom headline — defaults to "Unlock Full Market Insights" */
  headline?: string;
  /** Optional custom subtext */
  subtext?: string;
}

// ─── Email validation ────────────────────────────────────────────────────────
const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

// ─── Component ────────────────────────────────────────────────────────────────
export function EmailCaptureModal({
  sourceFeature,
  onSuccess,
  onClose,
  headline = "Unlock Full Market Insights",
  subtext = "Enter your email to see complete AI analysis, price trends, and investment scores.",
}: EmailCaptureModalProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<ModalStatus>("idle");
  const [fieldError, setFieldError] = useState("");
  const [serverError, setServerError] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus the email input on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  // Trap focus inside the modal and close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Focus trap
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        "button, input, a[href], [tabindex]:not([tabindex='-1'])"
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll while modal is open
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFieldError("");
      setServerError("");

      // Client-side validation
      if (!email.trim()) {
        setFieldError("Please enter your email address.");
        inputRef.current?.focus();
        return;
      }
      if (!isValidEmail(email)) {
        setFieldError("Please enter a valid email address.");
        inputRef.current?.focus();
        return;
      }

      setStatus("loading");

      try {
        const { error } = await supabase.from("email_subscribers").insert({
          email: email.trim().toLowerCase(),
          source_feature: sourceFeature,
          converted: false,
        });

        if (error) {
          // Postgres unique-violation code = 23505
          if (error.code === "23505") {
            // Duplicate email is fine — treat it as success so repeat visitors
            // aren't blocked; just update their source_feature if newer.
            await supabase
              .from("email_subscribers")
              .update({
                source_feature: sourceFeature,
                // Mark converted = true on re-engagement
                converted: true,
              })
              .eq("email", email.trim().toLowerCase());
          } else {
            throw error;
          }
        }

        // Persist to localStorage so we don't ask again this session
        localStorage.setItem("lux_email_captured", "true");
        localStorage.setItem("lux_email_captured_at", new Date().toISOString());

        setStatus("success");

        // Give the user a moment to read the success message, then unlock
        setTimeout(() => onSuccess(), 1600);
      } catch (err) {
        console.error("[EmailCaptureModal] insert error:", err);
        setStatus("error");
        setServerError("Something went wrong. Please try again.");
      }
    },
    [email, sourceFeature, onSuccess]
  );

  return (
    // ── Backdrop ──────────────────────────────────────────────────────────────
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ecm-heading"
      aria-describedby="ecm-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      onClick={(e) => {
        // Close if clicking the backdrop (not the card)
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ background: "rgba(10,8,6,0.75)", backdropFilter: "blur(6px)" }}
    >
      {/* ── Card ────────────────────────────────────────────────────────────── */}
      <div
        ref={modalRef}
        className="relative w-full max-w-md rounded-2xl border p-8 shadow-2xl"
        style={{
          background: "#1A1612",
          borderColor: "#2A2420",
        }}
        // Stop backdrop-click from firing when clicking card
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-lg p-1.5 transition-colors"
          style={{ color: "#9A9490" }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.color = "#FAF8F4")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.color = "#9A9490")
          }
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* ── Success state ────────────────────────────────────────────────── */}
        {status === "success" ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "rgba(16,185,129,0.12)" }}
            >
              <CheckCircle
                className="h-7 w-7"
                style={{ color: "#10b981" }}
                aria-hidden="true"
              />
            </div>
            <div>
              <p
                className="text-xl font-semibold"
                style={{ color: "#FAF8F4" }}
              >
                Thanks! Here's your analysis…
              </p>
              <p className="mt-1.5 text-sm" style={{ color: "#9A9490" }}>
                Loading your full insights now.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* ── Icon + heading ─────────────────────────────────────────── */}
            <div className="mb-6">
              <div
                className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: "rgba(184,134,11,0.12)" }}
              >
                <Mail
                  className="h-6 w-6"
                  style={{ color: "#B8860B" }}
                  aria-hidden="true"
                />
              </div>

              <p
                className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: "#B8860B" }}
              >
                Free access
              </p>

              <h2
                id="ecm-heading"
                className="text-2xl font-semibold leading-snug"
                style={{
                  fontFamily: "'Instrument Serif', Georgia, serif",
                  color: "#FAF8F4",
                }}
              >
                {headline}
              </h2>

              <p
                id="ecm-description"
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "#9A9490" }}
              >
                {subtext}
              </p>
            </div>

            {/* ── Form ──────────────────────────────────────────────────── */}
            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-4">
                <label
                  htmlFor="ecm-email"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.10em]"
                  style={{ color: "#B8860B" }}
                >
                  Email address
                </label>
                <input
                  ref={inputRef}
                  id="ecm-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldError) setFieldError("");
                    if (serverError) setServerError("");
                  }}
                  disabled={status === "loading"}
                  aria-invalid={!!fieldError}
                  aria-describedby={fieldError ? "ecm-field-err" : undefined}
                  placeholder="you@example.com"
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all disabled:opacity-50"
                  style={{
                    background: "#2A2420",
                    color: "#FAF8F4",
                    border: `1px solid ${fieldError ? "#ef4444" : "#3A3430"}`,
                    // Gold ring on focus — handled inline because we're not in
                    // a Tailwind dark-mode config here
                  }}
                  onFocus={(e) => {
                    if (!fieldError)
                      (e.target as HTMLInputElement).style.borderColor =
                        "#B8860B";
                  }}
                  onBlur={(e) => {
                    if (!fieldError)
                      (e.target as HTMLInputElement).style.borderColor =
                        "#3A3430";
                  }}
                />
                {fieldError && (
                  <p
                    id="ecm-field-err"
                    role="alert"
                    className="mt-1.5 flex items-center gap-1.5 text-xs"
                    style={{ color: "#ef4444" }}
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {fieldError}
                  </p>
                )}
              </div>

              {/* Server error banner */}
              {status === "error" && serverError && (
                <div
                  role="alert"
                  className="mb-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    borderColor: "rgba(239,68,68,0.25)",
                    color: "#f87171",
                  }}
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {serverError}
                </div>
              )}

              {/* CTA button */}
              <button
                type="submit"
                disabled={status === "loading"}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: "#B8860B",
                  color: "#FAF8F4",
                }}
                onMouseEnter={(e) => {
                  if (status !== "loading")
                    (e.currentTarget as HTMLElement).style.background =
                      "#9A7A0A";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#B8860B";
                }}
              >
                {status === "loading" ? (
                  <>
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2"
                      style={{
                        borderColor: "rgba(250,248,244,0.3)",
                        borderTopColor: "#FAF8F4",
                      }}
                      aria-hidden="true"
                    />
                    <span>Getting access…</span>
                  </>
                ) : (
                  <>
                    <span>Get Instant Access</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>

              <p className="mt-3 text-center text-[11px]" style={{ color: "#5A5450" }}>
                No spam. No password required. Unsubscribe any time.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
