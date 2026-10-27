# MedEx senior frontend take-home

One Next.js app, three exercises from the brief.

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The Dev panel (bottom right) injects latency, `500` / `409` / `402`, a route filter, and a fake offline flag.

## What to click

- `/explore` — faceted service search, 3,200 rows, filters in the URL
- `/cart` — multi-currency groups, guest merge, split checkout
- `/book` and `/book/reschedule` — 90-day calendar, two clocks, 409 alternatives

## Architecture

Stack is Next.js App Router, TypeScript, and Tailwind. No component library: native `<dialog>` for the mobile filter drawer, native inputs everywhere else, `Intl` for money and time.

JSON lives in `data/` and is read only by the mock API layer (`lib/data/*` + `app/api/*`). Components fetch `/api/...`. Default latency is 400ms. Query flags (`?fail=500&latency=0`) override the Dev panel cookies.

Task 1 filtering runs in the browser after one load. A round trip cannot meet the ~100ms facet budget. The URL is the source of truth (`lib/query.ts`); reload, share, and back/forward restore the same view. The first paint is skeletons, then the filtered list — never an unfiltered flash.

```
app/api/*          mock HTTP (latency, failure, in-memory cart/bookings)
lib/pricing.ts     decimal-string formula, round only at display
lib/facets.ts      visibility, filters, live facet counts, sort, grouping
lib/cart.ts        subtotals, merge, checkout eligibility
lib/qty.ts         coalesced quantity updates
lib/timezone.ts    free-text TZ → IANA
lib/slots.ts       slot walk, opening-hours clip, consecutive party
```

## Task 1 — explorer

**Visibility.** A service is shown only if `status` is true, the provider is `active`, and its category (when it has one) is active. Inactive providers drop 108 otherwise-active rows. `Seasonal Offers` is inactive. 22 services have no category; they stay visible.

**Ultrasound.** Two top-level categories share slug `ultrasound` (package vs lab_test). The URL stores category **id**, not slug.

**Price formula.** Same as the brief. Rounding happens only in `displayMoney`. A discount larger than the price floors at 0 (Vitamin D Test: 450 with a 600 amount discount). `homeTestCharge` is not in the formula; it is shown as an extra, not added in.

**Wellness.** `price` is null. The card shows “From {cheapest option}”, labelled as duration-dependent.

**Price filter.** A currency must be chosen. The range applies only to that currency; other currencies leave the result set. There is no conversion. Price sort puts comparable prices in the selected currency first, unpriced wellness last.

**Facets.** Each option’s count is “how many results if this facet were ignored and this value applied”, with every other filter held. Zero-count options stay visible and disabled so the layout does not jump.

**Relevance.** Title match, then provider name, then category, plus rating and recency.

**Measurement.** `lib/facets.test.ts` times `filterServices` + `computeFacets` over the full file. On this machine it is a few milliseconds, well under 100ms.

## Task 2 — cart

**Subtotals** are a map of currency → amount. Unpriced and empty-product lines are excluded, never treated as 0. There is no mixed-currency grand total. The summary lists each ready group separately.

**Quantity.** Clicks update immediately. In-flight requests coalesce to the latest desired quantity (`lib/qty.ts`). A 409/500 rolls back to the last confirmed value.

**Merge** (Log in and merge guest cart), identity = `productId` + wellness option:

| Guest | Server | Result |
| --- | --- | --- |
| Liver Function ×3 | ×2 | ×5 |
| Signature Facial, 90 min | Facial, no duration | 90 min applied, ×2 |
| Lipid Profile ×1 | — | added |
| Unknown product id | — | skipped, customer told |

**Checkout.** One order per group, sequential, each with an idempotency key written to `sessionStorage` before the request. The same key returns the same order (looked up before the failure gate). Retry only failed/unknown groups. A refresh re-reads `GET /orders/:id`. Confirm is blocked while the Dev panel marks the client offline.

**State machine:** ready → submitting → paid | failed | unknown. Unknown means the response never arrived; we do not assume a charge.

In-memory cart resets when `next dev` restarts.

## Task 3 — booking

**Timezone strings,** as stored:

| Stored | Resolved |
| --- | --- |
| `Asia/Bangkok` | `Asia/Bangkok` |
| ` UTC+05:45` | `Asia/Kathmandu` |
| `Nepal Standard Time` | `Asia/Kathmandu` |
| `(GMT+5:45)` | `Asia/Kathmandu` |
| `Asia/Katmandu ` (old spelling, trailing space) | `Asia/Kathmandu` |
| `""` + country `IN` | `Asia/Kolkata` |

**Slots.** Start at `consultation.startTime`, step `duration + buffer`. Last slot is the one that still ends by `consultation.endTime` and lies entirely inside that day’s opening hours. Missing weekday = closed. Closures use `dayOffset` from “today” at the provider when the API module loaded, so the file does not go stale.

Awkward hours:

- Dr. Chaiyaporn 07:00, clinic opens 08:00 → 07:00 dropped
- Dr. Rana until 21:00, clinic closes 20:00 → post-20:00 dropped; Friday close 17:00 → no overlap
- Party of N needs N consecutive free slots in that sequence; a booked middle slot blocks the previous start

Clinic time is the appointment. The customer’s local time is labelled underneath. “Today” and “already started” use the clinic clock.

## Left out

Real auth, FX rates, a card form, email, and a deployed URL. The catalog “Add” on the cart page is only there so reviewers can put extra lines in.

If I had more time: virtualize the explorer list, persist the cart to `localStorage`, booking idempotency keys, and a screen recording.

## AI use

Cursor (Grok) wrote the bulk of the scaffolding, domain functions, tests, and UI against the three PDFs and JSON files. I specified the stack, the URL/facet/merge/slot rules, and the mock failure panel. I can walk through every file.

## Tests

`npm test` — Vitest, pure functions only: price, facets (including the ultrasound collision, visibility, live counts, 100ms budget), quantity coalescing, guest merge, checkout state, every stored timezone, buffer walk, clipped hours, consecutive party of 2.
