import Link from "next/link";

export function AppHeader({ title }: { title: string }) {
  return (
    <header className="border-b border-[var(--line)] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          MedEx
        </Link>
        <p className="text-sm text-[var(--muted)]">{title}</p>
        <nav className="flex gap-3 text-sm">
          <Link href="/explore">Explore</Link>
          <Link href="/cart">Cart</Link>
          <Link href="/book">Book</Link>
        </nav>
      </div>
    </header>
  );
}
