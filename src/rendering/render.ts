import type {
  ButtonComponent,
  JuanPagerComponent,
  JuanPagerDocument,
  ProductComponent,
} from "../schema/document.js";
import {
  calculateTotals,
  documentStateKey,
  formatTotals,
  loadLocalState,
  productKey,
  resetLocalState,
  saveLocalState,
} from "../state/localState.js";
import { append, el, externalLink } from "./dom.js";
import {
  buildShoppingListText,
  collectProductLinks,
  collectProducts,
} from "./collect.js";

const AVAILABILITY_LABEL: Record<string, string> = {
  "in-stock": "In stock",
  limited: "Limited",
  "out-of-stock": "Out of stock",
  unknown: "Availability unknown",
};

export type RenderHandle = {
  root: HTMLElement;
  destroy: () => void;
};

export function applyTheme(theme: JuanPagerDocument["theme"]): void {
  const root = globalThis.document.documentElement;
  if (!theme || theme === "system") {
    root.removeAttribute("data-theme");
    return;
  }
  root.setAttribute("data-theme", theme);
}

function imageWithFallback(src: string, alt: string, className: string): HTMLElement {
  const wrap = el("div", { className: `${className}-wrap` });
  const img = el("img", {
    className,
    attrs: {
      src,
      alt,
      loading: "lazy",
      decoding: "async",
      referrerpolicy: "no-referrer",
    },
  });
  const fallback = el("div", {
    className: `${className}-fallback`,
    text: "Image unavailable",
    attrs: { hidden: true, role: "img", "aria-label": alt },
  });
  img.addEventListener("error", () => {
    img.hidden = true;
    fallback.hidden = false;
  });
  append(wrap, img, fallback);
  return wrap;
}

export function renderDocument(doc: JuanPagerDocument, mount: HTMLElement): RenderHandle {
  applyTheme(doc.theme);
  globalThis.document.title = `${doc.title} · JuanPager`;

  const stateKey = documentStateKey(doc);
  let state = loadLocalState(stateKey);

  const root = el("div", { className: "jp-page" });
  const header = el("header", { className: "jp-header" });
  append(
    header,
    el("p", { className: "jp-brand", text: "JuanPager" }),
    el("h1", { className: "jp-title", text: doc.title }),
  );
  if (doc.description) {
    append(header, el("p", { className: "jp-description", text: doc.description }));
  }

  const totalsEl = el("p", {
    className: "jp-totals",
    attrs: { "aria-live": "polite" },
  });
  append(header, totalsEl);

  const toolbar = el("div", { className: "jp-toolbar", attrs: { role: "toolbar" } });
  const themeBtn = el("button", {
    className: "jp-btn jp-btn-secondary",
    text: "Toggle theme",
    attrs: { type: "button" },
  });
  themeBtn.addEventListener("click", () => {
    const current = globalThis.document.documentElement.getAttribute("data-theme");
    if (current === "dark") applyTheme("light");
    else if (current === "light") applyTheme("system");
    else applyTheme("dark");
  });
  append(toolbar, themeBtn);
  append(header, toolbar);

  const main = el("div", { className: "jp-content" });
  const productIndex = { value: 0 };

  const persist = (): void => {
    saveLocalState(stateKey, state);
    updateTotals();
  };

  const getEffectiveProducts = (): Array<ProductComponent & { quantity?: number }> => {
    return collectProducts(doc).map((product, index) => {
      const key = productKey(product, index);
      const local = state.products[key];
      return {
        ...product,
        quantity: local?.quantity ?? product.quantity,
        checked: local?.checked ?? product.checked,
      };
    });
  };

  const updateTotals = (): void => {
    totalsEl.textContent = formatTotals(calculateTotals(getEffectiveProducts()));
  };

  const runAction = async (action: ButtonComponent["action"]): Promise<void> => {
    switch (action) {
      case "copy-page": {
        await navigator.clipboard.writeText(window.location.href);
        announce(toolbar, "Page link copied");
        break;
      }
      case "copy-list": {
        const quantities: Record<string, number | undefined> = {};
        collectProducts(doc).forEach((product, index) => {
          const key = productKey(product, index);
          quantities[key] = state.products[key]?.quantity ?? product.quantity;
        });
        const text = buildShoppingListText(doc, quantities, productKey);
        await navigator.clipboard.writeText(text);
        announce(toolbar, "Shopping list copied");
        break;
      }
      case "print-page": {
        window.print();
        break;
      }
      case "reset-state": {
        resetLocalState(stateKey);
        state = loadLocalState(stateKey);
        mount.replaceChildren();
        const next = renderDocument(doc, mount);
        root.replaceWith(next.root);
        break;
      }
      case "open-all-links": {
        for (const href of collectProductLinks(doc)) {
          window.open(href, "_blank", "noopener,noreferrer");
        }
        break;
      }
      default:
        break;
    }
  };

  const renderComponent = (component: JuanPagerComponent): HTMLElement => {
    switch (component.type) {
      case "heading": {
        const level = component.level ?? 2;
        const tag = level === 1 ? "h1" : level === 3 ? "h3" : "h2";
        return el(tag, {
          className: `jp-heading jp-heading-${level}`,
          text: component.text,
          attrs: component.id ? { id: component.id } : undefined,
        });
      }
      case "text":
        return el("p", {
          className: "jp-text",
          text: component.text,
          attrs: component.id ? { id: component.id } : undefined,
        });
      case "image": {
        const figure = el("figure", {
          className: "jp-figure",
          attrs: component.id ? { id: component.id } : undefined,
        });
        append(figure, imageWithFallback(component.src, component.alt, "jp-image"));
        if (component.caption) {
          append(figure, el("figcaption", { text: component.caption }));
        }
        return figure;
      }
      case "divider":
        return el("hr", { className: "jp-divider", attrs: component.id ? { id: component.id } : undefined });
      case "badge":
        return el("span", {
          className: `jp-badge jp-badge-${component.tone ?? "neutral"}`,
          text: component.text,
          attrs: component.id ? { id: component.id } : undefined,
        });
      case "price": {
        const currency = component.currency ?? "USD";
        const formatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
        }).format(component.amount);
        const wrap = el("div", {
          className: "jp-price",
          attrs: component.id ? { id: component.id } : undefined,
        });
        if (component.label) append(wrap, el("span", { className: "jp-price-label", text: component.label }));
        append(wrap, el("span", { className: "jp-price-amount", text: formatted }));
        return wrap;
      }
      case "summary": {
        const list = el("dl", {
          className: "jp-summary",
          attrs: component.id ? { id: component.id } : undefined,
        });
        for (const item of component.items) {
          append(list, el("dt", { text: item.label }), el("dd", { text: item.value }));
        }
        return list;
      }
      case "list": {
        const list = el(component.ordered ? "ol" : "ul", {
          className: "jp-list",
          attrs: component.id ? { id: component.id } : undefined,
        });
        for (const item of component.items) {
          append(list, el("li", { text: item }));
        }
        return list;
      }
      case "checklist": {
        const list = el("ul", {
          className: "jp-checklist",
          attrs: component.id ? { id: component.id } : undefined,
        });
        for (const item of component.items) {
          const li = el("li");
          const checkbox = el("input", {
            attrs: {
              type: "checkbox",
              id: `check-${item.id}`,
            },
          }) as HTMLInputElement;
          checkbox.checked = state.checklist[item.id] ?? item.checked ?? false;
          checkbox.addEventListener("change", () => {
            state.checklist[item.id] = checkbox.checked;
            persist();
          });
          const label = el("label", {
            text: item.label,
            attrs: { for: `check-${item.id}` },
          });
          append(li, checkbox, label);
          append(list, li);
        }
        return list;
      }
      case "link":
        return externalLink(component.href, component.label, "jp-link");
      case "button": {
        const button = el("button", {
          className: `jp-btn jp-btn-${component.variant ?? "primary"}`,
          text: component.label,
          attrs: {
            type: "button",
            ...(component.id ? { id: component.id } : {}),
          },
        });
        button.addEventListener("click", () => {
          void runAction(component.action);
        });
        return button;
      }
      case "product":
        return renderProduct(component);
      case "section": {
        const section = el("section", {
          className: "jp-section",
          attrs: component.id ? { id: component.id } : undefined,
        });
        const sectionId = component.id ?? `section-${component.title ?? "block"}`;
        const collapsed =
          state.sections[sectionId] ??
          (component.collapsed ?? false);

        if (component.title) {
          if (component.collapsible) {
            const toggle = el("button", {
              className: "jp-section-toggle",
              attrs: {
                type: "button",
                "aria-expanded": String(!collapsed),
              },
            });
            append(toggle, el("span", { text: component.title }));
            append(toggle, el("span", { className: "jp-section-chevron", text: collapsed ? "▸" : "▾" }));
            const body = el("div", { className: "jp-section-body" });
            body.hidden = collapsed;
            for (const child of component.components) append(body, renderComponent(child));
            toggle.addEventListener("click", () => {
              const next = !body.hidden;
              body.hidden = next;
              state.sections[sectionId] = next;
              toggle.setAttribute("aria-expanded", String(!next));
              toggle.querySelector(".jp-section-chevron")!.textContent = next ? "▸" : "▾";
              persist();
            });
            append(section, toggle, body);
          } else {
            append(section, el("h2", { className: "jp-section-title", text: component.title }));
            for (const child of component.components) append(section, renderComponent(child));
          }
        } else {
          for (const child of component.components) append(section, renderComponent(child));
        }
        return section;
      }
      case "grid": {
        const grid = el("div", {
          className: `jp-grid jp-grid-${component.columns ?? 2}`,
          attrs: component.id ? { id: component.id } : undefined,
        });
        for (const child of component.components) append(grid, renderComponent(child));
        return grid;
      }
      case "card": {
        const card = el("article", {
          className: "jp-card",
          attrs: component.id ? { id: component.id } : undefined,
        });
        if (component.title) {
          append(card, el("h3", { className: "jp-card-title", text: component.title }));
        }
        for (const child of component.components) append(card, renderComponent(child));
        return card;
      }
      default: {
        const _exhaustive: never = component;
        return el("p", { text: `Unsupported component: ${JSON.stringify(_exhaustive)}` });
      }
    }
  };

  function renderProduct(product: ProductComponent): HTMLElement {
    const index = productIndex.value;
    productIndex.value += 1;
    const key = productKey(product, index);
    const local = state.products[key] ?? {};
    const checked = local.checked ?? product.checked ?? false;
    const quantity = local.quantity ?? product.quantity ?? 1;

    const card = el("article", {
      className: `jp-product${checked ? " is-checked" : ""}`,
      attrs: {
        ...(product.id ? { id: product.id } : {}),
        "data-product-key": key,
      },
    });

    if (product.imageUrl) {
      append(card, imageWithFallback(product.imageUrl, product.name, "jp-product-image"));
    } else {
      append(
        card,
        el("div", {
          className: "jp-product-image-fallback",
          text: product.name.slice(0, 1).toUpperCase(),
          attrs: { "aria-hidden": "true" },
        }),
      );
    }

    const body = el("div", { className: "jp-product-body" });
    append(body, el("h3", { className: "jp-product-name", text: product.name }));
    if (product.store) append(body, el("p", { className: "jp-product-store", text: product.store }));

    const priceLine = el("p", { className: "jp-product-price" });
    if (product.displayPrice) {
      priceLine.textContent = product.displayPrice;
    } else if (typeof product.price === "number") {
      priceLine.textContent = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: product.currency ?? "USD",
      }).format(product.price);
    }
    append(body, priceLine);

    const meta = el("ul", { className: "jp-product-meta" });
    const addMeta = (label: string, value?: string | number): void => {
      if (value === undefined || value === "") return;
      const li = el("li");
      append(li, el("span", { className: "jp-meta-label", text: label }), el("span", { text: String(value) }));
      append(meta, li);
    };
    addMeta("Unit price", product.unitPrice);
    addMeta("Package", product.packageSize);
    if (product.availability) addMeta("Availability", AVAILABILITY_LABEL[product.availability] ?? product.availability);
    append(body, meta);

    if (product.badges?.length) {
      const badges = el("div", { className: "jp-product-badges" });
      for (const badge of product.badges) {
        append(badges, el("span", { className: "jp-badge jp-badge-info", text: badge }));
      }
      append(body, badges);
    }

    if (product.reason) {
      append(body, el("p", { className: "jp-product-reason", text: product.reason }));
    }
    if (product.description) {
      append(body, el("p", { className: "jp-product-description", text: product.description }));
    }

    const controls = el("div", { className: "jp-product-controls" });
    const qtyLabel = el("label", {
      className: "jp-qty",
      attrs: { for: `qty-${key}` },
    });
    append(qtyLabel, el("span", { text: "Qty" }));
    const qty = el("input", {
      attrs: {
        id: `qty-${key}`,
        type: "number",
        min: "0",
        max: "9999",
        value: String(quantity),
        inputmode: "numeric",
      },
    }) as HTMLInputElement;
    qty.addEventListener("change", () => {
      const next = Number.parseInt(qty.value, 10);
      state.products[key] = {
        ...state.products[key],
        quantity: Number.isFinite(next) ? Math.max(0, Math.min(9999, next)) : 0,
      };
      qty.value = String(state.products[key]!.quantity);
      persist();
    });
    append(qtyLabel, qty);

    const purchased = el("label", { className: "jp-purchased" });
    const checkbox = el("input", {
      attrs: { type: "checkbox" },
    }) as HTMLInputElement;
    checkbox.checked = checked;
    checkbox.addEventListener("change", () => {
      state.products[key] = { ...state.products[key], checked: checkbox.checked };
      card.classList.toggle("is-checked", checkbox.checked);
      persist();
    });
    append(purchased, checkbox, el("span", { text: "Purchased" }));
    append(controls, qtyLabel, purchased);

    if (product.productUrl) {
      append(controls, externalLink(product.productUrl, "View product", "jp-btn jp-btn-secondary jp-product-link"));
    }

    append(body, controls);
    append(card, body);
    return card;
  }

  for (const component of doc.components) {
    append(main, renderComponent(component));
  }

  const privacy = el("aside", { className: "jp-privacy" });
  append(
    privacy,
    el("strong", { text: "Privacy note: " }),
    el("span", {
      text: "This page data lives in the URL fragment. Anyone with the link can see it. Do not embed secrets or sensitive personal data.",
    }),
  );

  const footer = el("footer", { className: "jp-footer" });
  append(
    footer,
    el("a", {
      className: "jp-footer-link",
      text: "Open builder",
      attrs: { href: `${import.meta.env.BASE_URL}builder.html` },
    }),
    el("a", {
      className: "jp-footer-link",
      text: "Documentation",
      attrs: {
        href: "https://github.com/CakeRepository/juanpager#readme",
        target: "_blank",
        rel: "noopener noreferrer",
      },
    }),
  );

  append(root, header, main, privacy, footer);
  mount.replaceChildren(root);
  updateTotals();

  return {
    root,
    destroy: () => {
      mount.replaceChildren();
    },
  };
}

function announce(host: HTMLElement, message: string): void {
  const note = el("span", {
    className: "jp-sr-only",
    text: message,
    attrs: { role: "status", "aria-live": "polite" },
  });
  append(host, note);
  window.setTimeout(() => note.remove(), 2000);
}

export function renderError(
  mount: HTMLElement,
  options: {
    title: string;
    explanation: string;
    details?: string;
    onDemo: () => void;
    onClear: () => void;
    docsHref: string;
  },
): void {
  const root = el("div", { className: "jp-error" });
  append(root, el("p", { className: "jp-brand", text: "JuanPager" }));
  append(root, el("h1", { text: options.title }));
  append(root, el("p", { className: "jp-error-explain", text: options.explanation }));

  if (options.details) {
    const details = el("details", { className: "jp-error-details" });
    append(details, el("summary", { text: "Technical details" }));
    append(details, el("pre", { text: options.details }));
    append(root, details);
  }

  const actions = el("div", { className: "jp-error-actions" });
  const demoBtn = el("button", {
    className: "jp-btn jp-btn-primary",
    text: "Load demo page",
    attrs: { type: "button" },
  });
  demoBtn.addEventListener("click", options.onDemo);
  const clearBtn = el("button", {
    className: "jp-btn jp-btn-secondary",
    text: "Clear URL fragment",
    attrs: { type: "button" },
  });
  clearBtn.addEventListener("click", options.onClear);
  append(
    actions,
    demoBtn,
    clearBtn,
    el("a", {
      className: "jp-link",
      text: "Project documentation",
      attrs: {
        href: options.docsHref,
        target: "_blank",
        rel: "noopener noreferrer",
      },
    }),
  );
  append(root, actions);
  mount.replaceChildren(root);
}
