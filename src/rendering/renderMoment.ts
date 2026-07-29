import {
  AFFORDANCE_LABELS,
  MOMENT_LABELS,
  type Affordance,
} from "../components/registry.js";
import type {
  JuanPagerMomentDoc,
  LinkEntity,
  MomentEntity,
  NoteEntity,
  ProductEntity,
} from "../schema/moment.js";
import {
  calculateTotals,
  formatMoney,
  formatTotals,
  loadLocalState,
  momentStateKey,
  resetLocalState,
  saveLocalState,
  type LocalPageState,
} from "../state/localState.js";
import {
  buildMomentListText,
  effectiveChecked,
  effectiveQuantity,
  hasPrices,
  isLink,
  isNote,
  isProduct,
  momentLinks,
  priceText,
  pricedProducts,
  productLineTotal,
  resolveGroups,
  type EntityGroup,
  type EntityOverrides,
} from "./collectMoment.js";
import { announce, append, el, externalLink, imageWithFallback } from "./dom.js";
import { applyTheme, type RenderHandle } from "./render.js";

const AVAILABILITY_LABEL: Record<string, string> = {
  "in-stock": "In stock",
  limited: "Limited",
  "out-of-stock": "Out of stock",
  unknown: "Availability unknown",
};

type ToolbarEntry = {
  affordance: Affordance;
  label: string;
  variant: "primary" | "secondary" | "ghost";
};

/** Actions that move the reader's task forward sit above the content. */
const PRIMARY_BUTTONS: ToolbarEntry[] = [
  { affordance: "copy-list", label: "Copy list", variant: "primary" },
  { affordance: "print", label: "Print", variant: "secondary" },
  { affordance: "open-links", label: "Open all links", variant: "secondary" },
];

/** Housekeeping actions sit below it, where they cannot be hit by accident. */
const UTILITY_BUTTONS: ToolbarEntry[] = [
  { affordance: "copy-page", label: "Copy page link", variant: "ghost" },
  { affordance: "reset", label: "Reset changes", variant: "ghost" },
];

/**
 * Renders a 0.2 moment. The agent supplies intent, facts, and affordances;
 * every layout decision below belongs to the app, not to the agent.
 */
export function renderMoment(
  moment: JuanPagerMomentDoc,
  mount: HTMLElement,
): RenderHandle {
  applyTheme(moment.theme);
  globalThis.document.title = `${moment.title} · JuanPager`;

  const stateKey = momentStateKey(moment);
  const state: LocalPageState = loadLocalState(stateKey);
  const overrides: EntityOverrides = state.products;
  const listeners = new Set<() => void>();

  const can = (affordance: Affordance): boolean =>
    moment.affordances.includes(affordance);

  const groups = resolveGroups(moment);
  const products = moment.entities.filter(isProduct);
  const showTotals = hasPrices(moment);
  const showProgress = can("check") && products.length > 0;

  const root = el("div", {
    className: `jp-page jp-moment jp-moment-${moment.moment}`,
  });

  const persist = (): void => {
    saveLocalState(stateKey, state);
    for (const listener of listeners) listener();
  };

  const rerender = (): void => {
    renderMoment(moment, mount);
  };

  /* ------------------------------- header ------------------------------- */

  const header = el("header", { className: "jp-header" });
  const eyebrow = el("div", { className: "jp-eyebrow" });
  append(
    eyebrow,
    el("span", { className: "jp-brand", text: "JuanPager" }),
    el("span", {
      className: "jp-moment-chip",
      text: MOMENT_LABELS[moment.moment],
    }),
  );
  append(header, eyebrow, el("h1", { className: "jp-title", text: moment.title }));

  if (moment.goal) {
    append(header, el("p", { className: "jp-goal", text: moment.goal }));
  }
  if (moment.description) {
    append(header, el("p", { className: "jp-description", text: moment.description }));
  }

  if (moment.summary?.length) {
    const summary = el("dl", { className: "jp-summary jp-moment-summary" });
    for (const item of moment.summary) {
      append(summary, el("dt", { text: item.label }), el("dd", { text: item.value }));
    }
    append(header, summary);
  }

  const ledger = el("div", {
    className: "jp-ledger",
    attrs: { "aria-live": "polite" },
  });
  const ledgerTotal = el("span", { className: "jp-ledger-total" });
  const ledgerProgress = el("span", { className: "jp-ledger-progress" });
  if (showTotals) append(ledger, ledgerTotal);
  if (showProgress) append(ledger, ledgerProgress);
  if (showTotals || showProgress) append(header, ledger);

  const updateLedger = (): void => {
    if (showTotals) {
      ledgerTotal.textContent = formatTotals(
        calculateTotals(pricedProducts(moment, overrides)),
      );
    }
    if (showProgress) {
      const done = products.filter((product) =>
        effectiveChecked(product, overrides),
      ).length;
      ledgerProgress.textContent = `${done} of ${products.length} checked`;
    }
  };
  listeners.add(updateLedger);

  /* ------------------------------ affordances ---------------------------- */

  const toolbar = el("div", { className: "jp-toolbar", attrs: { role: "toolbar" } });

  const runAffordance = async (affordance: Affordance): Promise<void> => {
    switch (affordance) {
      case "copy-list": {
        await navigator.clipboard.writeText(buildMomentListText(moment, overrides));
        announce(root, "List copied");
        break;
      }
      case "copy-page": {
        await navigator.clipboard.writeText(window.location.href);
        announce(root, "Page link copied");
        break;
      }
      case "print": {
        window.print();
        break;
      }
      case "reset": {
        resetLocalState(stateKey);
        rerender();
        break;
      }
      case "open-links": {
        for (const href of momentLinks(moment)) {
          window.open(href, "_blank", "noopener,noreferrer");
        }
        break;
      }
      default:
        break;
    }
  };

  const affordanceButton = (
    affordance: Affordance,
    label: string,
    variant: string,
  ): HTMLButtonElement => {
    const button = el("button", {
      className: `jp-btn jp-btn-${variant}`,
      text: label,
      attrs: { type: "button", "data-affordance": affordance },
    });
    button.addEventListener("click", () => {
      void runAffordance(affordance);
    });
    return button;
  };

  for (const entry of PRIMARY_BUTTONS) {
    if (!can(entry.affordance)) continue;
    append(toolbar, affordanceButton(entry.affordance, entry.label, entry.variant));
  }
  if (toolbar.childElementCount > 0) append(header, toolbar);

  const utilityBar = el("div", { className: "jp-utility", attrs: { role: "toolbar" } });
  for (const entry of UTILITY_BUTTONS) {
    if (!can(entry.affordance)) continue;
    append(utilityBar, affordanceButton(entry.affordance, entry.label, entry.variant));
  }

  const themeBtn = el("button", {
    className: "jp-btn jp-btn-ghost",
    text: "Toggle theme",
    attrs: { type: "button" },
  });
  themeBtn.addEventListener("click", () => {
    const current = globalThis.document.documentElement.getAttribute("data-theme");
    if (current === "dark") applyTheme("light");
    else if (current === "light") applyTheme("system");
    else applyTheme("dark");
  });
  append(utilityBar, themeBtn);

  /* --------------------------- shared entity parts ------------------------ */

  const thumb = (product: ProductEntity, className: string): HTMLElement => {
    if (product.imageUrl) {
      return imageWithFallback(product.imageUrl, product.name, className);
    }
    return el("div", {
      className: `${className}-fallback`,
      text: product.name.slice(0, 1).toUpperCase(),
      attrs: { "aria-hidden": "true" },
    });
  };

  const metaLine = (product: ProductEntity, groupLabel: string | null): string => {
    const parts: string[] = [];
    if (product.store && product.store !== groupLabel) parts.push(product.store);
    if (product.packageSize) parts.push(product.packageSize);
    if (product.unitPrice) parts.push(product.unitPrice);
    if (product.availability) {
      parts.push(AVAILABILITY_LABEL[product.availability] ?? product.availability);
    }
    return parts.join(" · ");
  };

  const badgeRow = (product: ProductEntity): HTMLElement | null => {
    if (!product.badges?.length) return null;
    const row = el("div", { className: "jp-badges" });
    for (const badge of product.badges) {
      append(row, el("span", { className: "jp-badge jp-badge-info", text: badge }));
    }
    return row;
  };

  const checkControl = (product: ProductEntity, label: string): HTMLLabelElement => {
    const wrap = el("label", { className: "jp-check" });
    const box = el("input", {
      attrs: { type: "checkbox", "aria-label": `${label}: ${product.name}` },
    }) as HTMLInputElement;
    box.checked = effectiveChecked(product, overrides);
    box.addEventListener("change", () => {
      overrides[product.id] = { ...overrides[product.id], checked: box.checked };
      persist();
    });
    listeners.add(() => {
      const next = effectiveChecked(product, overrides);
      if (box.checked !== next) box.checked = next;
    });
    append(wrap, box, el("span", { className: "jp-check-label", text: label }));
    return wrap;
  };

  const qtyControl = (product: ProductEntity): HTMLElement => {
    const wrap = el("div", { className: "jp-stepper" });
    const input = el("input", {
      className: "jp-stepper-input",
      attrs: {
        id: `qty-${product.id}`,
        type: "number",
        min: "0",
        max: "9999",
        inputmode: "numeric",
        "aria-label": `Quantity for ${product.name}`,
      },
    }) as HTMLInputElement;
    input.value = String(effectiveQuantity(product, overrides));

    const setQuantity = (next: number): void => {
      const clamped = Number.isFinite(next)
        ? Math.max(0, Math.min(9999, Math.round(next)))
        : 0;
      overrides[product.id] = { ...overrides[product.id], quantity: clamped };
      input.value = String(clamped);
      persist();
    };

    const stepBtn = (label: string, delta: number): HTMLButtonElement => {
      const button = el("button", {
        className: "jp-stepper-btn",
        text: label,
        attrs: {
          type: "button",
          "aria-label": `${delta > 0 ? "Increase" : "Decrease"} quantity for ${product.name}`,
        },
      });
      button.addEventListener("click", () => {
        setQuantity(effectiveQuantity(product, overrides) + delta);
      });
      return button;
    };

    input.addEventListener("change", () => {
      setQuantity(Number.parseInt(input.value, 10));
    });

    append(wrap, stepBtn("−", -1), input, stepBtn("+", 1));
    return wrap;
  };

  const quantityBadge = (product: ProductEntity): HTMLElement => {
    const pill = el("span", { className: "jp-qty-pill" });
    const update = (): void => {
      pill.textContent = `×${effectiveQuantity(product, overrides)}`;
    };
    update();
    listeners.add(update);
    return pill;
  };

  /** Leads with what this line costs, and only mentions the unit price when it differs. */
  const priceAndTotal = (product: ProductEntity): HTMLElement => {
    const wrap = el("div", { className: "jp-line-money" });
    const total = el("span", { className: "jp-line-total" });
    const unit = el("span", { className: "jp-line-unit" });
    const base = priceText(product);

    const update = (): void => {
      const quantity = effectiveQuantity(product, overrides);
      const line = productLineTotal(product, overrides);
      if (line) {
        total.textContent = line;
        unit.textContent = quantity === 1 ? "" : `${base ?? ""} each`;
      } else {
        total.textContent = base ?? "";
        unit.textContent = quantity === 1 ? "" : `×${quantity}`;
      }
    };
    update();
    listeners.add(update);

    append(wrap, total, unit);
    return wrap;
  };

  const productControls = (product: ProductEntity, checkLabel: string): HTMLElement | null => {
    if (!can("check") && !can("adjust-qty")) return null;
    const controls = el("div", { className: "jp-controls" });
    if (can("adjust-qty")) append(controls, qtyControl(product));
    if (can("check")) append(controls, checkControl(product, checkLabel));
    return controls;
  };

  const productLink = (product: ProductEntity, label = "View"): HTMLElement | null => {
    if (!product.productUrl) return null;
    return externalLink(product.productUrl, label, "jp-btn jp-btn-ghost jp-inline-link");
  };

  const noteBlock = (note: NoteEntity): HTMLElement =>
    el("p", { className: "jp-note", text: note.text });

  const linkBlock = (link: LinkEntity): HTMLElement => {
    const row = el("p", { className: "jp-linkrow" });
    append(row, externalLink(link.href, link.label, "jp-link"));
    return row;
  };

  const groupHeading = (group: EntityGroup): HTMLElement | null => {
    if (!group.label) return null;
    const heading = el("div", { className: "jp-group-head" });
    append(
      heading,
      el("h2", { className: "jp-group-title", text: group.label }),
      el("span", {
        className: "jp-group-count",
        text: `${group.entities.length} item${group.entities.length === 1 ? "" : "s"}`,
      }),
    );
    return heading;
  };

  const groupSection = (group: EntityGroup, body: HTMLElement): HTMLElement => {
    const section = el("section", {
      className: "jp-group",
      attrs: { id: `group-${group.id}` },
    });
    append(section, groupHeading(group), body);
    return section;
  };

  /* ----------------------------- compositions ---------------------------- */

  const renderLine = (entity: MomentEntity, groupLabel: string | null): HTMLElement => {
    if (isNote(entity)) {
      const li = el("li", { className: "jp-line jp-line-note" });
      append(li, noteBlock(entity));
      return li;
    }
    if (isLink(entity)) {
      const li = el("li", { className: "jp-line jp-line-link" });
      append(li, linkBlock(entity));
      return li;
    }

    const li = el("li", {
      className: "jp-line jp-line-product",
      attrs: { "data-entity-id": entity.id },
    });
    append(li, thumb(entity, "jp-line-image"));

    const body = el("div", { className: "jp-line-body" });
    append(body, el("h3", { className: "jp-line-name", text: entity.name }));

    const meta = metaLine(entity, groupLabel);
    if (meta) append(body, el("p", { className: "jp-line-meta", text: meta }));
    if (entity.reason) {
      append(body, el("p", { className: "jp-line-reason", text: entity.reason }));
    }
    append(body, badgeRow(entity));
    append(body, productControls(entity, "Got it"));

    const side = el("div", { className: "jp-line-side" });
    append(side, priceAndTotal(entity), productLink(entity));

    append(li, body, side);

    const syncChecked = (): void => {
      li.classList.toggle("is-checked", effectiveChecked(entity, overrides));
    };
    syncChecked();
    listeners.add(syncChecked);

    return li;
  };

  const renderLineGroups = (className: string): HTMLElement => {
    const wrap = el("div", { className });
    for (const group of groups) {
      const list = el("ul", { className: "jp-lines" });
      for (const entity of group.entities) {
        append(list, renderLine(entity, group.label));
      }
      append(wrap, groupSection(group, list));
    }
    return wrap;
  };

  const renderOrderSummary = (): HTMLElement => {
    const card = el("aside", { className: "jp-order" });
    append(card, el("h2", { className: "jp-order-title", text: "Order summary" }));

    const rows = el("dl", { className: "jp-order-rows" });
    const itemsValue = el("dd");
    const totalValue = el("dd", { className: "jp-order-total" });
    append(
      rows,
      el("dt", { text: "Items" }),
      itemsValue,
      el("dt", { text: "Estimated total" }),
      totalValue,
    );
    append(card, rows);

    const update = (): void => {
      const units = products.reduce(
        (sum, product) => sum + effectiveQuantity(product, overrides),
        0,
      );
      itemsValue.textContent = `${units} across ${products.length} line${
        products.length === 1 ? "" : "s"
      }`;
      const totals = calculateTotals(pricedProducts(moment, overrides));
      totalValue.textContent =
        totals.length === 0
          ? "—"
          : totals
              .map((total) => formatMoney(total.amount, total.currency))
              .join(" · ");
    };
    update();
    listeners.add(update);

    append(
      card,
      el("p", {
        className: "jp-order-note",
        text: "Totals come from the data your agent supplied. Nothing is ordered or sent anywhere from this page.",
      }),
    );

    const actions = el("div", { className: "jp-order-actions" });
    if (can("copy-list")) {
      append(actions, affordanceButton("copy-list", "Copy shopping list", "primary"));
    }
    if (can("print")) {
      append(actions, affordanceButton("print", "Print checklist", "secondary"));
    }
    if (actions.childElementCount > 0) append(card, actions);

    return card;
  };

  const renderTrack = (): HTMLElement => {
    const wrap = el("div", { className: "jp-track" });
    for (const group of groups) {
      const list = el("ul", { className: "jp-track-list" });
      for (const entity of group.entities) {
        if (isProduct(entity)) {
          const li = el("li", {
            className: "jp-track-item",
            attrs: { "data-entity-id": entity.id },
          });
          if (can("check")) append(li, checkControl(entity, "Got it"));
          const body = el("div", { className: "jp-track-body" });
          append(body, el("span", { className: "jp-track-name", text: entity.name }));
          const meta = metaLine(entity, group.label);
          if (meta) append(body, el("span", { className: "jp-track-meta", text: meta }));
          append(li, body);

          const side = el("div", { className: "jp-track-side" });
          if (can("adjust-qty")) append(side, qtyControl(entity));
          else append(side, quantityBadge(entity));
          const price = priceText(entity);
          if (price) append(side, el("span", { className: "jp-track-price", text: price }));
          append(side, productLink(entity));
          append(li, side);

          const syncChecked = (): void => {
            li.classList.toggle("is-checked", effectiveChecked(entity, overrides));
          };
          syncChecked();
          listeners.add(syncChecked);
          append(list, li);
          continue;
        }

        const li = el("li", { className: "jp-track-item jp-track-aside" });
        append(li, isNote(entity) ? noteBlock(entity) : linkBlock(entity));
        append(list, li);
      }
      append(wrap, groupSection(group, list));
    }
    return wrap;
  };

  const renderChoose = (): HTMLElement => {
    const wrap = el("div", { className: "jp-choices" });
    for (const entity of moment.entities) {
      if (!isProduct(entity)) {
        const aside = el("div", { className: "jp-choice jp-choice-aside" });
        append(aside, isNote(entity) ? noteBlock(entity) : linkBlock(entity));
        append(wrap, aside);
        continue;
      }

      const card = el("article", {
        className: "jp-choice",
        attrs: { "data-entity-id": entity.id },
      });
      append(card, thumb(entity, "jp-choice-image"));

      const body = el("div", { className: "jp-choice-body" });
      append(body, el("h3", { className: "jp-choice-name", text: entity.name }));
      const price = priceText(entity);
      if (price) append(body, el("p", { className: "jp-choice-price", text: price }));
      const meta = metaLine(entity, null);
      if (meta) append(body, el("p", { className: "jp-choice-meta", text: meta }));
      if (entity.reason) {
        append(body, el("p", { className: "jp-choice-reason", text: entity.reason }));
      }
      append(body, badgeRow(entity));

      const foot = el("div", { className: "jp-choice-foot" });
      if (can("check")) append(foot, checkControl(entity, "Pick this"));
      if (can("adjust-qty")) append(foot, qtyControl(entity));
      append(foot, productLink(entity, "Details"));
      append(body, foot);
      append(card, body);

      const syncChecked = (): void => {
        card.classList.toggle("is-selected", effectiveChecked(entity, overrides));
      };
      syncChecked();
      listeners.add(syncChecked);

      append(wrap, card);
    }
    return wrap;
  };

  const attributeList = (product: ProductEntity): HTMLElement => {
    const rows = el("dl", { className: "jp-attrs" });
    const addRow = (label: string, value?: string | null): void => {
      if (!value) return;
      append(rows, el("dt", { text: label }), el("dd", { text: value }));
    };
    addRow("Price", priceText(product));
    addRow("Unit price", product.unitPrice);
    addRow("Package", product.packageSize);
    addRow("Store", product.store);
    addRow(
      "Availability",
      product.availability
        ? AVAILABILITY_LABEL[product.availability] ?? product.availability
        : null,
    );
    return rows;
  };

  const renderInspect = (): HTMLElement => {
    const wrap = el("div", { className: "jp-inspect" });
    const focus = moment.entities.find(isProduct);

    if (focus) {
      const hero = el("article", {
        className: "jp-hero",
        attrs: { "data-entity-id": focus.id },
      });
      append(hero, thumb(focus, "jp-hero-image"));

      const body = el("div", { className: "jp-hero-body" });
      append(body, el("h2", { className: "jp-hero-name", text: focus.name }));
      const price = priceText(focus);
      if (price) append(body, el("p", { className: "jp-hero-price", text: price }));
      append(body, badgeRow(focus));
      if (focus.reason) {
        append(body, el("p", { className: "jp-hero-reason", text: focus.reason }));
      }
      append(body, attributeList(focus));
      append(body, productControls(focus, "Got it"));
      const link = productLink(focus, "Open product page");
      if (link) append(body, link);
      append(hero, body);
      append(wrap, hero);
    }

    const rest = moment.entities.filter((entity) => entity !== focus);
    if (rest.length) {
      const section = el("section", { className: "jp-supporting" });
      append(
        section,
        el("h2", { className: "jp-group-title", text: "Also worth knowing" }),
      );
      for (const entity of rest) {
        if (isNote(entity)) append(section, noteBlock(entity));
        else if (isLink(entity)) append(section, linkBlock(entity));
        else {
          const row = el("p", { className: "jp-supporting-product" });
          const price = priceText(entity);
          row.textContent = price ? `${entity.name} — ${price}` : entity.name;
          append(section, row);
        }
      }
      append(wrap, section);
    }

    return wrap;
  };

  const renderCompare = (): HTMLElement => {
    const wrap = el("div", { className: "jp-compare-wrap" });
    const track = el("div", { className: "jp-compare" });

    for (const product of products) {
      const column = el("article", {
        className: "jp-compare-col",
        attrs: { "data-entity-id": product.id },
      });
      append(column, thumb(product, "jp-compare-image"));
      append(column, el("h3", { className: "jp-compare-name", text: product.name }));
      const price = priceText(product);
      if (price) append(column, el("p", { className: "jp-compare-price", text: price }));
      append(column, attributeList(product));
      append(column, badgeRow(product));
      if (product.reason) {
        append(column, el("p", { className: "jp-compare-reason", text: product.reason }));
      }
      append(column, productControls(product, "Pick this"));
      append(column, productLink(product, "Details"));

      const syncChecked = (): void => {
        column.classList.toggle("is-selected", effectiveChecked(product, overrides));
      };
      syncChecked();
      listeners.add(syncChecked);

      append(track, column);
    }
    append(wrap, track);

    const asides = moment.entities.filter(
      (entity): entity is NoteEntity | LinkEntity => !isProduct(entity),
    );
    if (asides.length) {
      const section = el("section", { className: "jp-supporting" });
      for (const entity of asides) {
        append(section, isNote(entity) ? noteBlock(entity) : linkBlock(entity));
      }
      append(wrap, section);
    }

    return wrap;
  };

  const renderCollect = (): HTMLElement => {
    const wrap = el("div", { className: "jp-collect" });

    for (const group of groups) {
      const panel = el("div", { className: "jp-collect-panel" });
      const notes = group.entities.filter(isNote);
      const links = group.entities.filter(isLink);
      const groupProducts = group.entities.filter(isProduct);

      if (notes.length) {
        const list = el("ul", { className: "jp-collect-notes" });
        for (const note of notes) {
          const li = el("li", { className: "jp-collect-note" });
          append(li, noteBlock(note));
          append(list, li);
        }
        append(panel, list);
      }

      if (groupProducts.length) {
        const list = el("ul", { className: "jp-collect-items" });
        for (const product of groupProducts) {
          const li = el("li", {
            className: "jp-collect-item",
            attrs: { "data-entity-id": product.id },
          });
          if (can("check")) append(li, checkControl(product, "Got it"));
          append(li, el("span", { className: "jp-collect-name", text: product.name }));
          if (can("adjust-qty")) append(li, qtyControl(product));
          const price = priceText(product);
          if (price) append(li, el("span", { className: "jp-collect-price", text: price }));
          append(list, li);
        }
        append(panel, list);
      }

      if (links.length) {
        const list = el("ul", { className: "jp-collect-links" });
        for (const link of links) {
          const li = el("li");
          append(li, externalLink(link.href, link.label, "jp-link"));
          append(list, li);
        }
        append(panel, list);
      }

      append(wrap, groupSection(group, panel));
    }

    return wrap;
  };

  const renderBrowse = (): HTMLElement => {
    const wrap = el("div", { className: "jp-browse" });
    for (const group of groups) {
      const list = el("ul", { className: "jp-browse-list" });
      for (const entity of group.entities) {
        const li = el("li", { className: "jp-browse-row" });

        if (isProduct(entity)) {
          li.setAttribute("data-entity-id", entity.id);
          if (can("check")) append(li, checkControl(entity, "Seen"));
          const body = el("div", { className: "jp-browse-body" });
          append(body, el("span", { className: "jp-browse-name", text: entity.name }));
          const meta = metaLine(entity, group.label);
          if (meta) append(body, el("span", { className: "jp-browse-meta", text: meta }));
          append(li, body);
          const price = priceText(entity);
          if (price) append(li, el("span", { className: "jp-browse-price", text: price }));
          append(li, productLink(entity, "Open"));
        } else if (isNote(entity)) {
          append(li, noteBlock(entity));
        } else {
          append(li, linkBlock(entity));
        }

        append(list, li);
      }
      append(wrap, groupSection(group, list));
    }
    return wrap;
  };

  const renderComposition = (): HTMLElement => {
    switch (moment.moment) {
      case "confirm": {
        const wrap = el("div", { className: "jp-checkout" });
        append(wrap, renderLineGroups("jp-checkout-lines"), renderOrderSummary());
        return wrap;
      }
      case "track":
        return renderTrack();
      case "choose":
        return renderChoose();
      case "inspect":
        return renderInspect();
      case "compare":
        return renderCompare();
      case "collect":
        return renderCollect();
      case "browse":
        return renderBrowse();
      default:
        return renderTrack();
    }
  };

  const main = el("div", { className: "jp-content" });
  append(main, renderComposition());

  /* ------------------------------- footer -------------------------------- */

  if (moment.continuation?.kind === "note") {
    const continuation = el("aside", { className: "jp-continuation" });
    append(
      continuation,
      el("strong", { text: "What happens next: " }),
      el("span", { text: moment.continuation.text }),
    );
    append(main, continuation);
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
    el("span", {
      className: "jp-footer-note",
      text: `Moment: ${MOMENT_LABELS[moment.moment]} · Affordances: ${
        moment.affordances.map((a) => AFFORDANCE_LABELS[a]).join(", ") || "none"
      }`,
    }),
  );

  append(root, header, main);
  if (utilityBar.childElementCount > 0) append(root, utilityBar);
  append(root, privacy, footer);
  mount.replaceChildren(root);
  updateLedger();

  return {
    root,
    destroy: () => {
      listeners.clear();
      mount.replaceChildren();
    },
  };
}
