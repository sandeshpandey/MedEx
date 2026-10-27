import Link from "next/link";

const tasks = [
  {
    href: "/explore",
    title: "Service explorer",
    body: "Browse 3,200 services by provider. Faceted filters live in the URL.",
  },
  {
    href: "/cart",
    title: "Split checkout",
    body: "A cart with several currencies, a guest merge, and per-group payment.",
  },
  {
    href: "/book",
    title: "Appointment booking",
    body: "Pick a slot across time zones, including a reschedule from an existing booking.",
  },
];

export default function HomePage() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm tracking-wide text-[var(--muted)] uppercase">
        MedEx take-home
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Senior frontend assessment
      </h1>
      <p className="mt-3 max-w-xl text-[var(--muted)]">
        Three exercises, one app. Each route has a mock API with latency and
        failures you can inject from the Dev panel.
      </p>
      <ul className="mt-8 grid gap-4">
        {tasks.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              className="block rounded-xl border border-[var(--line)] bg-white p-5 hover:border-[var(--accent)]"
            >
              <h2 className="text-lg font-semibold">{t.title}</h2>
              <p className="mt-1 text-[var(--muted)]">{t.body}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
