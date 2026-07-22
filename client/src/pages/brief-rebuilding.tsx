import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

// Placeholder for the postcode brief while the generation pipeline is rebuilt
// (Phase 0 teardown). The full brief is reconstructed in later phases per
// BRIEF_SPEC.md.
export default function BriefRebuildingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Brief generation is being rebuilt.
          </h1>
          <p className="mt-4 text-muted-foreground">
            The postcode brief is temporarily unavailable while we rebuild it.
            Please check back soon.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
