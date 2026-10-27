import { expect, test } from "vitest";
import { finalPrice, hasDiscount, wellnessFromPrice } from "./pricing";

test("percent discount then percent service charge, no mid-rounding", () => {
  const n = finalPrice({
    price: "6200.00",
    discount: "10.00",
    discountType: "percent",
    serviceCharge: "7.00",
    serviceChargeType: "percent",
  });
  expect(n).toBe(6200 * 0.9 * 1.07);
});

test("amount discount exceeding price floors at zero then adds charge", () => {
  const n = finalPrice({
    price: "450.00",
    discount: "600.00",
    discountType: "amount",
    serviceCharge: "0.00",
    serviceChargeType: "amount",
  });
  expect(n).toBe(0);
});

test("wellness from-price is the cheapest option after formula", () => {
  const from = wellnessFromPrice([
    {
      id: "60",
      durationInMinutes: 60,
      price: "1800.00",
      discount: "0.00",
      discountType: "amount",
      serviceCharge: "0.00",
      serviceChargeType: "amount",
    },
    {
      id: "90",
      durationInMinutes: 90,
      price: "2400.00",
      discount: "15.00",
      discountType: "percent",
      serviceCharge: "0.00",
      serviceChargeType: "amount",
    },
  ]);
  expect(from).toBe(1800);
  expect(hasDiscount({ price: "2400.00", discount: "15.00", discountType: "percent", serviceCharge: "0", serviceChargeType: "amount" })).toBe(true);
});

test("null price stays unknown", () => {
  expect(
    finalPrice({
      price: null,
      discount: null,
      discountType: null,
      serviceCharge: null,
      serviceChargeType: null,
    }),
  ).toBeNull();
});
