const BASE = "/lapi";

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-admin-token": localStorage.getItem("ls_admin_token") ?? "",
  };
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { ...init, headers: headers() });
  if (!r.ok) {
    const e = await r.json().catch(() => ({})) as { error?: string };
    throw new Error(e.error ?? `HTTP ${r.status}`);
  }
  return r.json() as Promise<T>;
}

export const api = {
  getStats: () => req<Stats>("/admin/stats"),

  getProducts: () => req<Product[]>("/admin/products"),
  createProduct: (b: CreateProductBody) =>
    req<Product>("/admin/products", { method: "POST", body: JSON.stringify(b) }),
  updateProduct: (id: number, b: Partial<CreateProductBody>) =>
    req<Product>(`/admin/products/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  deleteProduct: (id: number) =>
    req<{ success: boolean }>(`/admin/products/${id}`, { method: "DELETE" }),

  getCustomers: () => req<Customer[]>("/admin/customers"),
  createCustomer: (b: { name: string; email: string; notes?: string }) =>
    req<Customer>("/admin/customers", { method: "POST", body: JSON.stringify(b) }),
  deleteCustomer: (id: number) =>
    req<{ success: boolean }>(`/admin/customers/${id}`, { method: "DELETE" }),

  getLicenses: () => req<License[]>("/admin/licenses"),
  createLicense: (b: CreateLicenseBody) =>
    req<License>("/admin/licenses", { method: "POST", body: JSON.stringify(b) }),
  revokeLicense: (id: number) =>
    req<{ success: boolean }>(`/admin/licenses/${id}/revoke`, { method: "POST" }),
  restoreLicense: (id: number) =>
    req<{ success: boolean }>(`/admin/licenses/${id}/restore`, { method: "POST" }),
  deleteLicense: (id: number) =>
    req<{ success: boolean }>(`/admin/licenses/${id}`, { method: "DELETE" }),

  getPayments: () => req<Payment[]>("/admin/payments"),
  createPayment: (b: CreatePaymentBody) =>
    req<Payment>("/admin/payments", { method: "POST", body: JSON.stringify(b) }),
  verifyPayment: (id: number) =>
    req<VerifyPaymentResult>(`/admin/payments/${id}/verify`, { method: "POST" }),
  deletePayment: (id: number) =>
    req<{ success: boolean }>(`/admin/payments/${id}`, { method: "DELETE" }),

  getPricing: () => req<Record<string, number | string>>("/admin/pricing"),
  updatePricing: (b: Record<string, number | string>) =>
    req<{ success: boolean }>("/admin/pricing", { method: "PUT", body: JSON.stringify(b) }),

  getPurchaseSessions: () => req<unknown[]>("/admin/purchase-sessions"),
};

export interface Stats {
  totalCustomers: number;
  activeLicenses: number;
  totalLicenses: number;
  pendingPayments: number;
  verifiedPayments: number;
  totalProducts: number;
}

export interface Product {
  id: number;
  name: string;
  description?: string | null;
  status: string;
  monthlyPriceSol?: number | null;
  annualPriceSol?: number | null;
  lifetimePriceSol?: number | null;
  monthlyPriceUsdc?: number | null;
  annualPriceUsdc?: number | null;
  lifetimePriceUsdc?: number | null;
  vaultWalletAddress?: string | null;
  licenseCount?: number;
  createdAt: string;
}

export interface CreateProductBody {
  name: string;
  description?: string;
  status?: "active" | "inactive";
  monthlyPriceSol?: number | null;
  annualPriceSol?: number | null;
  lifetimePriceSol?: number | null;
  monthlyPriceUsdc?: number | null;
  annualPriceUsdc?: number | null;
  lifetimePriceUsdc?: number | null;
  vaultWalletAddress?: string | null;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  notes?: string | null;
  createdAt: string;
}

export interface License {
  id: number;
  key: string;
  customerId?: number | null;
  customerName?: string | null;
  customerEmail?: string | null;
  productId?: number | null;
  productName?: string | null;
  plan: string;
  status: string;
  instanceId?: string | null;
  instanceName?: string | null;
  activatedAt?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface Payment {
  id: number;
  customerId?: number | null;
  customerName?: string | null;
  licenseId?: number | null;
  licenseKey?: string | null;
  txSignature?: string | null;
  amountSol?: number | null;
  amountUsdc?: number | null;
  currency: string;
  status: string;
  notes?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
}

export interface CreateLicenseBody {
  customerId?: number;
  productId?: number;
  plan?: "monthly" | "annual" | "lifetime";
  expiresAt?: string;
  notes?: string;
}

export interface CreatePaymentBody {
  customerId?: number;
  licenseId?: number;
  txSignature?: string;
  amountSol?: number;
  amountUsdc?: number;
  currency?: "SOL" | "USDC";
  notes?: string;
}

export interface VerifyPaymentResult {
  verified: boolean;
  error?: string;
  amountSol?: number;
  amountUsdc?: number;
  currency?: string;
}
