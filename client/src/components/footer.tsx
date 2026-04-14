import { LuxPropertyLogo } from "./logo";

export function Footer() {
  return (
    <footer className="border-t border-border/60 py-10 mt-auto">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <LuxPropertyLogo />
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} LuxProperty.ai. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
