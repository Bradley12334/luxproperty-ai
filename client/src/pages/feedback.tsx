import { useState, useRef } from "react";
import { Link } from "wouter";
import { ArrowLeft, Send, CheckCircle, AlertCircle } from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";

type Status = "idle" | "loading" | "success" | "error";

export default function FeedbackPage() {
  useDocumentTitle("Send Feedback — LuxProperty.ai", "Send a message directly about bugs, suggestions, or missing data on LuxProperty.ai.");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; message?: string }>({});

  const nameRef = useRef<HTMLInputElement>(null);

  const validate = () => {
    const errs: typeof fieldErrors = {};
    if (!name.trim()) errs.name = "Please enter your name.";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "Please enter a valid email address.";
    if (!message.trim() || message.trim().length < 5) errs.message = "Message must be at least 5 characters.";
    if (message.trim().length > 2000) errs.message = "Message must be under 2000 characters.";
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth-email?action=contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMsg(data.error || "Message failed to send. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Message failed to send. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4] dark:bg-[#0E0C0A] text-[#1A1612] dark:text-[#FAF8F4]">
      {/* Nav strip */}
      <div className="border-b border-[#E8E4DE] dark:border-[#2A2420]">
        <div className="max-w-screen-md mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/">
            <a className="inline-flex items-center gap-2 text-sm text-[#9A9490] hover:text-[#1A1612] dark:hover:text-[#FAF8F4] transition-colors">
              <ArrowLeft className="w-4 h-4" />
              LuxProperty.ai
            </a>
          </Link>
        </div>
      </div>

      <div className="max-w-screen-md mx-auto px-6 py-16 sm:py-24">
        {/* Header */}
        <div className="mb-12">
          <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-[#B8860B] mb-3">
            FEEDBACK
          </p>
          <h1 className="font-['Instrument_Serif'] text-3xl sm:text-4xl text-[#1A1612] dark:text-[#FAF8F4] leading-tight mb-4">
            Send us a message
          </h1>
          <p className="text-[#9A9490] text-base leading-relaxed max-w-md">
            Spotted a bug, confusing result, or missing detail? Send a message
            directly — it goes only to us and won't be shown publicly.
          </p>
        </div>

        {/* Success state */}
        {status === "success" ? (
          <div className="bg-[#1A1612] dark:bg-[#1A1612] border border-[#2A2420] rounded-xl p-8 sm:p-10 text-center">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="text-[#FAF8F4] font-semibold text-lg mb-2">Thanks — your message has been sent.</p>
            <p className="text-[#9A9490] text-sm leading-relaxed mb-8">
              We'll read it carefully. If you left a reply address we'll get back to you if needed.
            </p>
            <button
              onClick={() => {
                setStatus("idle");
                setName("");
                setEmail("");
                setMessage("");
                setFieldErrors({});
                setTimeout(() => nameRef.current?.focus(), 50);
              }}
              className="text-sm text-[#B8860B] hover:text-[#9A7A0A] transition-colors underline underline-offset-4"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="bg-[#1A1612] dark:bg-[#1A1612] border border-[#2A2420] rounded-xl p-8 sm:p-10 space-y-6"
          >
            {/* Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="feedback-name"
                className="block text-xs font-semibold tracking-[0.10em] uppercase text-[#B8860B]"
              >
                Name
              </label>
              <input
                ref={nameRef}
                id="feedback-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined }));
                }}
                disabled={status === "loading"}
                aria-describedby={fieldErrors.name ? "feedback-name-err" : undefined}
                aria-invalid={!!fieldErrors.name}
                placeholder="Your name"
                className={`w-full bg-[#2A2420] text-[#FAF8F4] placeholder-[#5A5450] border rounded-lg px-4 py-3 text-sm outline-none transition-colors focus:border-[#B8860B] focus:ring-1 focus:ring-[#B8860B]/40 disabled:opacity-50 ${
                  fieldErrors.name ? "border-red-500/60" : "border-[#3A3430]"
                }`}
              />
              {fieldErrors.name && (
                <p id="feedback-name-err" role="alert" className="text-xs text-red-400 mt-1">{fieldErrors.name}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="feedback-email"
                className="block text-xs font-semibold tracking-[0.10em] uppercase text-[#B8860B]"
              >
                Email
              </label>
              <input
                id="feedback-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
                }}
                disabled={status === "loading"}
                aria-describedby={fieldErrors.email ? "feedback-email-err" : undefined}
                aria-invalid={!!fieldErrors.email}
                placeholder="you@example.com"
                className={`w-full bg-[#2A2420] text-[#FAF8F4] placeholder-[#5A5450] border rounded-lg px-4 py-3 text-sm outline-none transition-colors focus:border-[#B8860B] focus:ring-1 focus:ring-[#B8860B]/40 disabled:opacity-50 ${
                  fieldErrors.email ? "border-red-500/60" : "border-[#3A3430]"
                }`}
              />
              {fieldErrors.email && (
                <p id="feedback-email-err" role="alert" className="text-xs text-red-400 mt-1">{fieldErrors.email}</p>
              )}
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <label
                htmlFor="feedback-message"
                className="block text-xs font-semibold tracking-[0.10em] uppercase text-[#B8860B]"
              >
                Message
              </label>
              <textarea
                id="feedback-message"
                rows={5}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (fieldErrors.message) setFieldErrors((p) => ({ ...p, message: undefined }));
                }}
                disabled={status === "loading"}
                aria-describedby={fieldErrors.message ? "feedback-message-err" : undefined}
                aria-invalid={!!fieldErrors.message}
                placeholder="Describe the bug, confusing output, or suggestion…"
                className={`w-full bg-[#2A2420] text-[#FAF8F4] placeholder-[#5A5450] border rounded-lg px-4 py-3 text-sm outline-none transition-colors focus:border-[#B8860B] focus:ring-1 focus:ring-[#B8860B]/40 resize-y disabled:opacity-50 ${
                  fieldErrors.message ? "border-red-500/60" : "border-[#3A3430]"
                }`}
              />
              <div className="flex items-start justify-between gap-2">
                {fieldErrors.message ? (
                  <p id="feedback-message-err" role="alert" className="text-xs text-red-400">{fieldErrors.message}</p>
                ) : (
                  <span />
                )}
                <p className={`text-xs tabular-nums shrink-0 ${message.length > 1800 ? "text-amber-400" : "text-[#5A5450]"}`}>
                  {message.length}/2000
                </p>
              </div>
            </div>

            {/* Error banner */}
            {status === "error" && errorMsg && (
              <div role="alert" className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{errorMsg}</p>
              </div>
            )}

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={status === "loading"}
                className="inline-flex items-center gap-2 bg-[#B8860B] hover:bg-[#9A7A0A] text-[#FAF8F4] font-semibold text-sm px-6 py-3 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1612]"
              >
                {status === "loading" ? (
                  <>
                    <span className="w-4 h-4 border-2 border-[#FAF8F4]/30 border-t-[#FAF8F4] rounded-full animate-spin" aria-hidden="true" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send message
                  </>
                )}
              </button>
              <p className="text-[11px] text-[#5A5450] mt-3">
                Your message is sent privately to the site owner only.
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
