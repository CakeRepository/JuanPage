import type {
  JuanPagerMomentDoc,
  LinkEntity,
  MomentEntity,
  NoteEntity,
  ProductEntity,
} from "../schema/moment.js";
import { formatMoney } from "../state/localState.js";

export type EntityGroup = {
  id: string;
  /** null means "no heading" — a single implicit group. */
  label: string | null;
  entities: MomentEntity[];
};

export type EntityOverride = {
  checked?: boolean;
  quantity?: number;
};

export type EntityOverrides = Record<string, EntityOverride>;

export function isProduct(entity: MomentEntity): entity is ProductEntity {
  return entity.type === "product";
}

export function isNote(entity: MomentEntity): entity is NoteEntity {
  return entity.type === "note";
}

export function isLink(entity: MomentEntity): entity is LinkEntity {
  return entity.type === "link";
}

export function entityIndex(moment: JuanPagerMomentDoc): Map<string, MomentEntity> {
  return new Map(moment.entities.map((entity) => [entity.id, entity]));
}

/**
 * Declared groups win. Otherwise stores become groups when they read like a
 * shopping trip, so a checkout surface is organised by where you walk.
 */
export function resolveGroups(moment: JuanPagerMomentDoc): EntityGroup[] {
  if (moment.groups?.length) {
    const index = entityIndex(moment);
    const claimed = new Set<string>();
    const groups: EntityGroup[] = [];

    for (const group of moment.groups) {
      const entities: MomentEntity[] = [];
      for (const id of group.entityIds) {
        const entity = index.get(id);
        if (!entity || claimed.has(id)) continue;
        claimed.add(id);
        entities.push(entity);
      }
      if (entities.length) {
        groups.push({ id: group.id, label: group.label, entities });
      }
    }

    const leftovers = moment.entities.filter((entity) => !claimed.has(entity.id));
    if (leftovers.length) {
      groups.push({ id: "ungrouped", label: "More", entities: leftovers });
    }
    return groups;
  }

  const products = moment.entities.filter(isProduct);
  const storeGrouped =
    products.length > 1 &&
    products.every((product) => Boolean(product.store)) &&
    new Set(products.map((product) => product.store)).size > 1;

  if (storeGrouped) {
    const byStore = new Map<string, MomentEntity[]>();
    for (const entity of moment.entities) {
      const store = isProduct(entity) ? entity.store! : "More";
      const bucket = byStore.get(store) ?? [];
      bucket.push(entity);
      byStore.set(store, bucket);
    }
    return [...byStore.entries()].map(([store, entities]) => ({
      id: `store-${slug(store)}`,
      label: store,
      entities,
    }));
  }

  return [{ id: "all", label: null, entities: moment.entities }];
}

export function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "item"
  );
}

export function effectiveQuantity(
  product: ProductEntity,
  overrides: EntityOverrides,
): number {
  return overrides[product.id]?.quantity ?? product.quantity ?? 1;
}

export function effectiveChecked(
  product: ProductEntity,
  overrides: EntityOverrides,
): boolean {
  return overrides[product.id]?.checked ?? product.checked ?? false;
}

export function pricedProducts(
  moment: JuanPagerMomentDoc,
  overrides: EntityOverrides,
): Array<{ price?: number; quantity?: number; currency?: string }> {
  return moment.entities.filter(isProduct).map((product) => ({
    price: product.price,
    quantity: effectiveQuantity(product, overrides),
    currency: product.currency,
  }));
}

export function hasPrices(moment: JuanPagerMomentDoc): boolean {
  return moment.entities.some(
    (entity) =>
      isProduct(entity) &&
      (typeof entity.price === "number" || Boolean(entity.displayPrice)),
  );
}

export function momentLinks(moment: JuanPagerMomentDoc): string[] {
  const links: string[] = [];
  for (const entity of moment.entities) {
    if (isProduct(entity) && entity.productUrl) links.push(entity.productUrl);
    if (isLink(entity)) links.push(entity.href);
  }
  return [...new Set(links)];
}

export function productLineTotal(
  product: ProductEntity,
  overrides: EntityOverrides,
): string | null {
  if (typeof product.price !== "number") return null;
  const quantity = effectiveQuantity(product, overrides);
  return formatMoney(product.price * quantity, product.currency ?? "USD");
}

export function priceText(product: ProductEntity): string | null {
  if (product.displayPrice) return product.displayPrice;
  if (typeof product.price === "number") {
    return formatMoney(product.price, product.currency ?? "USD");
  }
  return null;
}

export function buildMomentListText(
  moment: JuanPagerMomentDoc,
  overrides: EntityOverrides,
): string {
  const lines: string[] = [moment.title];
  if (moment.goal) lines.push(moment.goal);
  lines.push("");

  for (const group of resolveGroups(moment)) {
    if (group.label) lines.push(`${group.label}:`);
    for (const entity of group.entities) {
      if (isProduct(entity)) {
        const quantity = effectiveQuantity(entity, overrides);
        const checked = effectiveChecked(entity, overrides) ? "x" : " ";
        const price = priceText(entity);
        lines.push(
          `- [${checked}] ${quantity}x ${entity.name}${price ? ` — ${price}` : ""}`,
        );
      } else if (isNote(entity)) {
        lines.push(`- ${entity.text}`);
      } else {
        lines.push(`- ${entity.label}: ${entity.href}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
