import { base64UrlToBytes, bytesToBase64Url } from "../encoding/base64url.js";
import type { JuanPagerMomentDoc, ProductEntity } from "../schema/moment.js";
import {
  emptyLocalState,
  momentStateKey,
  type LocalPageState,
} from "../state/localState.js";

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

const RECEIPT_PREFIX = "juanreceipt:v1:";

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

export function encodeMomentReceiptToken(receipt: MomentReceipt): string {
  const bytes = new TextEncoder().encode(JSON.stringify(receipt));
  return bytesToBase64Url(bytes);
}

export function encodeMomentReceipt(receipt: MomentReceipt): string {
  return `${RECEIPT_PREFIX}${encodeMomentReceiptToken(receipt)}`;
}

export function decodeMomentReceipt(value: string): MomentReceipt {
  const token = value.startsWith(RECEIPT_PREFIX) ? value.slice(RECEIPT_PREFIX.length) : value;
  const parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(token))) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Receipt must be an object");
  }
  const object = parsed as Record<string, unknown>;
  if (
    object.version !== "0.1" ||
    typeof object.source !== "string" ||
    typeof object.title !== "string" ||
    typeof object.updatedAt !== "string" ||
    !Array.isArray(object.changes)
  ) {
    throw new Error("Receipt has an unsupported shape");
  }

  const changes: ReceiptChange[] = object.changes.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Receipt change must be an object");
    }
    const change = entry as Record<string, unknown>;
    if (typeof change.id !== "string") throw new Error("Receipt change id is required");
    const normalized: ReceiptChange = { id: change.id };
    if (typeof change.checked === "boolean") normalized.checked = change.checked;
    if (typeof change.quantity === "number" && Number.isInteger(change.quantity)) {
      normalized.quantity = Math.max(0, Math.min(9999, change.quantity));
    }
    return normalized;
  });

  return {
    version: "0.1",
    source: object.source,
    title: object.title,
    updatedAt: object.updatedAt,
    changes,
    ...(typeof object.note === "string" ? { note: object.note.slice(0, 1000) } : {}),
    ...(typeof object.context === "string" ? { context: object.context } : {}),
  };
}

export function receiptHasChanges(receipt: MomentReceipt): boolean {
  return receipt.changes.length > 0 || Boolean(receipt.note?.trim());
}

export function stateFromReceipt(
  moment: JuanPagerMomentDoc,
  receipt: MomentReceipt,
): LocalPageState {
  if (receipt.source !== momentStateKey(moment)) {
    throw new Error("Receipt does not belong to this moment");
  }

  const known = new Set(
    moment.entities
      .filter((entity): entity is ProductEntity => entity.type === "product")
      .map((product) => product.id),
  );
  const state = emptyLocalState();
  for (const change of receipt.changes) {
    if (!known.has(change.id)) continue;
    state.products[change.id] = {
      ...(typeof change.checked === "boolean" ? { checked: change.checked } : {}),
      ...(typeof change.quantity === "number" ? { quantity: change.quantity } : {}),
    };
  }
  if (receipt.note) state.responseNote = receipt.note;
  return state;
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
