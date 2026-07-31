import { bytesToBase64Url } from "../encoding/base64url.js";
import type { JuanPagerMomentDoc, ProductEntity } from "../schema/moment.js";
import { momentStateKey, type LocalPageState } from "../state/localState.js";

export type ReceiptChange = {
  id: string;
  checked?: boolean;
  quantity?: number;
};

export type MomentReceipt = {
  version: "0.1";
  source: string;
  title: string;
  updatedAt: string;
  changes: ReceiptChange[];
  note?: string;
  context?: string;
};

function productDefaults(product: ProductEntity): { checked: boolean; quantity: number } {
  return {
    checked: product.checked ?? false,
    quantity: product.quantity ?? 1,
  };
}

export function buildMomentReceipt(
  moment: JuanPagerMomentDoc,
  state: LocalPageState,
): MomentReceipt {
  const products = moment.entities.filter(
    (entity): entity is ProductEntity => entity.type === "product",
  );
  const changes: ReceiptChange[] = [];

  for (const product of products) {
    const override = state.products[product.id];
    if (!override) continue;

    const defaults = productDefaults(product);
    const change: ReceiptChange = { id: product.id };

    if (typeof override.checked === "boolean" && override.checked !== defaults.checked) {
      change.checked = override.checked;
    }
    if (typeof override.quantity === "number" && override.quantity !== defaults.quantity) {
      change.quantity = override.quantity;
    }

    if (change.checked !== undefined || change.quantity !== undefined) {
      changes.push(change);
    }
  }

  const note = state.responseNote?.trim();
  const context =
    typeof moment.metadata?.returnContext === "string"
      ? moment.metadata.returnContext
      : undefined;

  return {
    version: "0.1",
    source: momentStateKey(moment),
    title: moment.title,
    updatedAt: new Date().toISOString(),
    changes,
    ...(note ? { note } : {}),
    ...(context ? { context } : {}),
  };
}

export function encodeMomentReceipt(receipt: MomentReceipt): string {
  const bytes = new TextEncoder().encode(JSON.stringify(receipt));
  return `juanreceipt:v1:${bytesToBase64Url(bytes)}`;
}

export function buildMomentReceiptText(
  moment: JuanPagerMomentDoc,
  state: LocalPageState,
): string {
  const receipt = buildMomentReceipt(moment, state);
  const productNames = new Map(
    moment.entities
      .filter((entity): entity is ProductEntity => entity.type === "product")
      .map((product) => [product.id, product.name]),
  );
  const lines = ["JuanPager update", `Page: ${receipt.title}`];

  if (receipt.changes.length === 0) {
    lines.push("Changes: none");
  } else {
    lines.push("Changes:");
    for (const change of receipt.changes) {
      const parts: string[] = [];
      if (change.checked !== undefined) {
        parts.push(change.checked ? "checked" : "unchecked");
      }
      if (change.quantity !== undefined) {
        parts.push(`quantity ${change.quantity}`);
      }
      lines.push(`- ${productNames.get(change.id) ?? change.id}: ${parts.join(", ")}`);
    }
  }

  if (receipt.note) lines.push(`Note: ${receipt.note}`);
  if (receipt.context) lines.push(`Context: ${receipt.context}`);
  lines.push("", encodeMomentReceipt(receipt));
  return lines.join("\n");
}
