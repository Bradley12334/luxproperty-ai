export function LuxPropertyLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="LuxProperty logo"
      >
        {/* Geometric diamond / building mark */}
        <path
          d="M16 2L28 16L16 30L4 16L16 2Z"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M16 8L22 16L16 24L10 16L16 8Z"
          stroke="hsl(43, 90%, 38%)"
          strokeWidth="1.5"
          fill="none"
          className="dark:stroke-[hsl(43,75%,50%)]"
        />
        <line x1="16" y1="2" x2="16" y2="8" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        <line x1="16" y1="24" x2="16" y2="30" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        <line x1="4" y1="16" x2="10" y2="16" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        <line x1="22" y1="16" x2="28" y2="16" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      </svg>
      <span className="font-serif text-lg tracking-tight">
        <span className="font-normal">Lux</span>
        <span className="font-normal text-primary">Property</span>
        <span className="text-muted-foreground text-sm">.ai</span>
      </span>
    </div>
  );
}

export function LuxPropertyLogoMark() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="LuxProperty"
    >
      <path
        d="M16 2L28 16L16 30L4 16L16 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M16 8L22 16L16 24L10 16L16 8Z"
        stroke="hsl(43, 90%, 38%)"
        strokeWidth="1.5"
        fill="none"
        className="dark:stroke-[hsl(43,75%,50%)]"
      />
    </svg>
  );
}
