import { expect, test } from "vitest";
import { applyResult, retryable, type CheckoutGroup } from "./checkout";

const ready = (): CheckoutGroup => ({
  type: "lab_test",
  paymentMethod: "card",
  idempotencyKey: "lab-1",
  status: "submitting",
});

test("success marks paid and keeps the order id", () => {
  const next = applyResult(ready(), {
    ok: true,
    orderId: "ORD-1",
    status: "paid",
  });
  expect(next.status).toBe("paid");
  expect(next.orderId).toBe("ORD-1");
  expect(retryable(next)).toBe(false);
});

test("402/409/500 mark failed and stay retryable with the same key", () => {
  const next = applyResult(ready(), { ok: false, status: 409, message: "busy" });
  expect(next.status).toBe("failed");
  expect(next.idempotencyKey).toBe("lab-1");
  expect(retryable(next)).toBe(true);
});

test("dropped response is unknown, not a new charge", () => {
  const next = applyResult(ready(), { ok: false, status: 0, unknown: true });
  expect(next.status).toBe("unknown");
  expect(retryable(next)).toBe(true);
});
