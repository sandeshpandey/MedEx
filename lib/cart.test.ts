import { expect, test } from "vitest";
import {
  groupIsCheckoutable,
  lineUnitPrice,
  mergeGuestCart,
  rebuildCart,
  type CartLine,
  type CatalogProduct,
  type GuestItem,
} from "./cart";

const catalog: CatalogProduct[] = [
  {
    id: "liver",
    title: "Liver Function Profile",
    type: "lab_test",
    currency: "NPR",
    providerId: 1,
    providerName: "A",
    price: 4760,
  },
  {
    id: "lipid",
    title: "Lipid Profile",
    type: "lab_test",
    currency: "THB",
    providerId: 2,
    providerName: "B",
    price: 984.4,
  },
  {
    id: "facial",
    title: "Signature Facial",
    type: "wellness",
    currency: "THB",
    providerId: 3,
    providerName: "Spa",
    price: null,
    priceUnknown: true,
    wellnessPricing: [
      { id: "60", durationInMinutes: 60, amount_after_service_charge: 1800 },
      { id: "90", durationInMinutes: 90, amount_after_service_charge: 2040 },
    ],
  },
];

const server: CartLine[] = [
  {
    id: "l1",
    productId: "liver",
    quantity: 2,
    product: catalog[0],
  },
  {
    id: "f1",
    productId: "facial",
    quantity: 1,
    product: catalog[2],
  },
  {
    id: "gone",
    productId: "missing",
    quantity: 1,
    product: {},
  },
];

const guest: GuestItem[] = [
  { productId: "liver", quantity: 3 },
  { productId: "lipid", quantity: 1 },
  { productId: "facial", quantity: 1, wellnessPricingId: "90" },
  { productId: "nope", quantity: 1 },
];

test("merge sums overlapping lines, applies guest duration, skips unknown", () => {
  const { lines, changes } = mergeGuestCart(server, guest, catalog);
  const liver = lines.find((l) => l.productId === "liver")!;
  expect(liver.quantity).toBe(5);
  const facial = lines.find((l) => l.productId === "facial")!;
  expect(facial.quantity).toBe(2);
  expect(facial.wellnessPricingId).toBe("90");
  expect(lines.some((l) => l.productId === "lipid")).toBe(true);
  expect(changes.some((c) => c.kind === "skipped_unknown")).toBe(true);
});

test("unpriced wellness and empty product are never counted as zero", () => {
  const cart = rebuildCart(server);
  const wellness = cart.groups.find((g) => g.type === "wellness")!;
  expect(wellness.subtotals).toEqual({});
  expect(wellness.unpricedItems).toBe(1);
  const unknown = cart.groups.find((g) => g.type === "unknown")!;
  expect(unknown.subtotals).toEqual({});
  expect(groupIsCheckoutable(wellness)).toBe(false);
  expect(groupIsCheckoutable(unknown)).toBe(false);
});

test("wellness line prices only after a duration is chosen", () => {
  const open: CartLine = { ...server[1] };
  expect(lineUnitPrice(open)).toBeNull();
  expect(lineUnitPrice({ ...open, wellnessPricingId: "90" })).toBe(2040);
});

test("subtotals stay per currency", () => {
  const cart = rebuildCart([
    server[0],
    {
      id: "t1",
      productId: "lipid",
      quantity: 1,
      product: catalog[1],
    },
  ]);
  const labs = cart.groups.find((g) => g.type === "lab_test")!;
  expect(labs.subtotals).toEqual({ NPR: 9520, THB: 984.4 });
});
