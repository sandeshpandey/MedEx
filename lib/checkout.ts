export type CheckoutGroupState =
  | "ready"
  | "submitting"
  | "paid"
  | "failed"
  | "unknown";

export type CheckoutGroup = {
  type: string;
  paymentMethod: "card" | "pay_at_clinic";
  idempotencyKey: string;
  orderId?: string;
  status: CheckoutGroupState;
  message?: string;
};

export type CheckoutSession = {
  groups: CheckoutGroup[];
};

const STORAGE_KEY = "medex-checkout";

export function newIdempotencyKey(groupType: string): string {
  return `${groupType}-${crypto.randomUUID()}`;
}

export function readSession(): CheckoutSession | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CheckoutSession) : null;
  } catch {
    return null;
  }
}

export function writeSession(session: CheckoutSession): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function applyResult(
  group: CheckoutGroup,
  result:
    | { ok: true; orderId: string; status: "pending" | "paid" | "failed" }
    | { ok: false; status: number; unknown?: boolean; message?: string },
): CheckoutGroup {
  if (result.ok) {
    return {
      ...group,
      orderId: result.orderId,
      status: result.status === "failed" ? "failed" : "paid",
      message: result.status === "failed" ? "Payment failed" : undefined,
    };
  }
  if (result.unknown) {
    return { ...group, status: "unknown", message: "We could not confirm this payment." };
  }
  return {
    ...group,
    status: "failed",
    message: result.message ?? `Checkout failed (${result.status})`,
  };
}

export function retryable(group: CheckoutGroup): boolean {
  return group.status === "failed" || group.status === "unknown";
}
