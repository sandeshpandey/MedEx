export type DiscountType = "percent" | "amount" | null;
export type ChargeType = "percent" | "amount" | null;

export type PricedFields = {
  price: string | null;
  discount: string | null;
  discountType: DiscountType;
  serviceCharge: string | null;
  serviceChargeType: ChargeType;
};

export type WellnessOption = PricedFields & {
  id: string;
  durationInMinutes: number;
};

function parseDecimal(raw: string | null | undefined): number {
  if (raw == null || raw === "") return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Unparseable money value: ${raw}`);
  return n;
}

export function finalPrice(fields: PricedFields): number | null {
  if (fields.price == null || fields.price === "") return null;
  const price = parseDecimal(fields.price);
  const discount = parseDecimal(fields.discount);
  const charge = parseDecimal(fields.serviceCharge);
  const discountAmount =
    fields.discountType === "percent" ? price * (discount / 100) : discount;
  const afterDiscount = Math.max(0, price - discountAmount);
  const chargeAmount =
    fields.serviceChargeType === "percent"
      ? afterDiscount * (charge / 100)
      : charge;
  return afterDiscount + chargeAmount;
}

export function displayMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function originalPrice(fields: PricedFields): number | null {
  if (fields.price == null || fields.price === "") return null;
  return parseDecimal(fields.price);
}

export function hasDiscount(fields: PricedFields): boolean {
  return parseDecimal(fields.discount) > 0;
}

export function wellnessFromPrice(options: WellnessOption[]): number | null {
  const prices = options
    .map((o) => finalPrice(o))
    .filter((n): n is number => n != null);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}
