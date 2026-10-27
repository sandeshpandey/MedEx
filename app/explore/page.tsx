import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Explorer } from "@/components/explore/Explorer";

function Fallback() {
  return (
    <main id="main" className="mx-auto max-w-6xl px-4 py-6">
      <div className="h-10 w-48 animate-pulse rounded bg-[var(--line)]" />
      <div className="mt-6 h-64 animate-pulse rounded-xl bg-[var(--line)]" />
    </main>
  );
}

export default function ExplorePage() {
  return (
    <>
      <AppHeader title="Service explorer" />
      <Suspense fallback={<Fallback />}>
        <Explorer />
      </Suspense>
    </>
  );
}
