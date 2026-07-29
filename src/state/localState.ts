import type { JuanPagerDocument, ProductComponent } from "../schema/document.js";

export type LocalProductState = {
  checked?: boolean;
  quantity?: number;
};

export type LocalPageState = {
  products: Record<string, LocalProductState>;
  checklist: Record<string, boolean>;
  sections: Record<string, boolean>;
};

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function documentStateKey(document: JuanPagerDocument): string {
  // Stable key from the decoded document so different links do not share state.
  const canonical = JSON.stringify(document);
  return `juanpager:v0.1:${fnv1a(canonical)}:${canonical.length}`;
}

export function emptyLocalState(): LocalPageState {
  return { products: {}, checklist: {}, sections: {} };
}

export function loadLocalState(key: string): LocalPageState {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return emptyLocalState();
    const parsed = JSON.parse(raw) as Partial<LocalPageState>;
    return {
      products: parsed.products ?? {},
      checklist: parsed.checklist ?? {},
      sections: parsed.sections ?? {},
    };
  } catch {
    return emptyLocalState();
  }
}

export function saveLocalState(key: string, state: LocalPageState): void {
  localStorage.setItem(key, JSON.stringify(state));
}

export function resetLocalState(key: string): void {
  localStorage.removeItem(key);
}

export function productKey(product: ProductComponent, index: number): string {
  return product.id ?? `product-${index}-${product.name}`;
}

export type CurrencyTotal = {
  currency: string;
  amount: number;
};

export function calculateTotals(
  products: Array<{ price?: number; quantity?: number; currency?: string }>,
): CurrencyTotal[] {
  const map = new Map<string, number>();
  for (const product of products) {
    if (typeof product.price !== "number" || typeof product.quantity !== "number") {
      continue;
    }
    const currency = product.currency ?? "USD";
    const current = map.get(currency) ?? 0;
    map.set(currency, current + product.price * product.quantity);
  }
  return [...map.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function formatMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatTotals(totals: CurrencyTotal[]): string {
  if (totals.length === 0) return "Estimated total: —";
  if (totals.length === 1) {
    const only = totals[0]!;
    return `Estimated total: ${formatMoney(only.amount, only.currency)}`;
  }
  return `Estimated total: ${totals
    .map((total) => formatMoney(total.amount, total.currency))
    .join(" · ")}`;
}
