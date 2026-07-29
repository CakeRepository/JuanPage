import type { JuanPagerComponent, JuanPagerDocument, ProductComponent } from "../schema/document.js";

export function walkComponents(
  components: JuanPagerComponent[],
  visit: (component: JuanPagerComponent) => void,
): void {
  for (const component of components) {
    visit(component);
    if (
      component.type === "section" ||
      component.type === "grid" ||
      component.type === "card"
    ) {
      walkComponents(component.components, visit);
    }
  }
}

export function collectProducts(document: JuanPagerDocument): ProductComponent[] {
  const products: ProductComponent[] = [];
  walkComponents(document.components, (component) => {
    if (component.type === "product") products.push(component);
  });
  return products;
}

export function collectProductLinks(document: JuanPagerDocument): string[] {
  const links: string[] = [];
  walkComponents(document.components, (component) => {
    if (component.type === "product" && component.productUrl) {
      links.push(component.productUrl);
    }
    if (component.type === "link") {
      links.push(component.href);
    }
  });
  return [...new Set(links)];
}

export function buildShoppingListText(
  document: JuanPagerDocument,
  quantities: Record<string, number | undefined>,
  productKeys: (product: ProductComponent, index: number) => string,
): string {
  const lines: string[] = [document.title, ""];
  const products = collectProducts(document);
  products.forEach((product, index) => {
    const key = productKeys(product, index);
    const qty = quantities[key] ?? product.quantity ?? 1;
    const price = product.displayPrice ?? (typeof product.price === "number" ? String(product.price) : "");
    const store = product.store ? ` @ ${product.store}` : "";
    lines.push(`- [${qty}x] ${product.name}${store}${price ? ` — ${price}` : ""}`);
  });
  return lines.join("\n");
}
