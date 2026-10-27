export type ServiceType =
  | "package"
  | "lab_test"
  | "wellness"
  | "service"
  | "insurance"
  | "unknown";

export type Currency = "THB" | "NPR" | "INR";

export type Category = {
  id: string;
  title: string;
  slug: string;
  type: ServiceType;
  position: number;
  status: boolean;
  parentId: string | null;
  children?: Category[];
};

export type ProviderInfo = {
  companyName: string;
  slug: string;
  types: ServiceType[];
  currency: Currency;
  city: { id: string; name: string; slug: string } | null;
  country: { id: number; name: string; alphaCode: string } | null;
  rating: number | null;
  reviewCount: number;
};

export type Provider = {
  id: number;
  name: string;
  username: string;
  status: string;
  providerInformation: ProviderInfo;
};

export type RawService = {
  id: string;
  title: string;
  slug: string;
  type: ServiceType;
  userId: number;
  categoryId: string | null;
  subCategoryId: string | null;
  price: string | null;
  discount: string | null;
  discountType: "percent" | "amount" | null;
  serviceCharge: string | null;
  serviceChargeType: "percent" | "amount" | null;
  status: boolean;
  testAtHome: boolean;
  homeTestCharge: string | null;
  wellnessPricing: {
    id: string;
    durationInMinutes: number;
    price: string;
    discount: string;
    discountType: "percent" | "amount";
    serviceCharge: string;
    serviceChargeType: "percent" | "amount";
  }[];
  createdAt: string;
};

export type SortKey = "relevance" | "price_asc" | "price_desc" | "rating";

export type Filters = {
  q: string;
  types: ServiceType[];
  categoryId: string | null;
  subCategoryId: string | null;
  providerIds: number[];
  city: string | null;
  country: string | null;
  currency: Currency | null;
  minPrice: number | null;
  maxPrice: number | null;
  homeTest: boolean | null;
  sort: SortKey;
  page: number;
};

export const PAGE_SIZE = 8;
