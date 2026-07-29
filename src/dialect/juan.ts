import { AFFORDANCES, MOMENT_TYPES, type Affordance } from "../components/registry.js";
import { validateMoment, type JuanPagerMomentDoc, type MomentEntity } from "../schema/moment.js";
import { slug } from "../rendering/collectMoment.js";

/**
 * The Juan dialect is a line-oriented text format agents can emit without
 * escaping JSON. It compiles to a 0.2 moment and nothing else — there is no
 * path from dialect text to markup.
 */

export class DialectError extends Error {
  readonly details: string;

  constructor(message: string, details: string) {
    super(message);
    this.name = "DialectError";
    this.details = details;
  }
}

const SEGMENT_SPLIT = /\s*[·•]\s*|\s+\|\s+/;
const KEY_VALUE = /^([a-zA-Z][\w-]*)\s*:\s*(.*)$/;
const CHECKBOX = /^\[([ xX])\]\s*/;
const QTY_SEGMENT = /^(?:qty|quantity)\s+(\d{1,4})$/i;
const QTY_SHORT = /^(?:x\s*(\d{1,4})|(\d{1,4})\s*x)$/i;
const MONEY_SEGMENT = /^[$€£¥]\s*\d[\d,]*(?:\.\d{1,2})?$|^\d[\d,]*\.\d{2}$/;
const URL_SEGMENT = /^https?:\/\//i;

type DraftGroup = { id: string; label: string; entityIds: string[] };

function fail(line: number, message: string, hint?: string): never {
  throw new DialectError(
    "This Juan dialect document could not be compiled.",
    `Line ${line}: ${message}${hint ? `\n${hint}` : ""}`,
  );
}

function parseMoney(segment: string): number | undefined {
  const numeric = segment.replace(/[^0-9.]/g, "");
  const value = Number.parseFloat(numeric);
  return Number.isFinite(value) ? value : undefined;
}

function uniqueId(base: string, used: Set<string>): string {
  const root = slug(base);
  if (!used.has(root)) {
    used.add(root);
    return root;
  }
  let counter = 2;
  while (used.has(`${root}-${counter}`)) counter += 1;
  const id = `${root}-${counter}`;
  used.add(id);
  return id;
}

export function compileJuanDialect(source: string): JuanPagerMomentDoc {
  const lines = source.split(/\r?\n/);

  let title: string | undefined;
  let momentType: string | undefined;
  let goal: string | undefined;
  let description: string | undefined;
  let theme: string | undefined;
  let continuation: string | undefined;
  let defaultCurrency = "USD";
  let defaultStore: string | undefined;
  let declaredAffordances: Affordance[] | undefined;

  const summary: Array<{ label: string; value: string }> = [];
  const entities: MomentEntity[] = [];
  const groups: DraftGroup[] = [];
  const usedEntityIds = new Set<string>();
  const usedGroupIds = new Set<string>();

  let currentGroup: DraftGroup | null = null;
  let inSummaryBlock = false;
  let sawCheckbox = false;
  let sawQuantity = false;
  let sawLink = false;

  const pushEntity = (entity: MomentEntity): void => {
    entities.push(entity);
    if (currentGroup) currentGroup.entityIds.push(entity.id);
  };

  const parseEntityLine = (raw: string, lineNo: number): MomentEntity => {
    let body = raw;
    let checked: boolean | undefined;

    const checkbox = CHECKBOX.exec(body);
    if (checkbox) {
      sawCheckbox = true;
      checked = checkbox[1]!.toLowerCase() === "x";
      body = body.slice(checkbox[0].length);
    }

    const noteMatch = /^note\s*:\s*(.+)$/i.exec(body);
    if (noteMatch) {
      return {
        type: "note",
        id: uniqueId(`note-${entities.length + 1}`, usedEntityIds),
        text: noteMatch[1]!.trim(),
      };
    }

    const linkMatch = /^link\s*:\s*(.+)$/i.exec(body);
    if (linkMatch) {
      sawLink = true;
      const rest = linkMatch[1]!.trim();
      const parts = rest.split("|").map((part) => part.trim());
      const href = parts.length > 1 ? parts[parts.length - 1]! : rest;
      const label = parts.length > 1 ? parts.slice(0, -1).join(" | ") : rest;
      if (!URL_SEGMENT.test(href)) {
        fail(lineNo, `Link "${rest}" must end with an https URL.`, "Use: - link: Label | https://example.com");
      }
      return {
        type: "link",
        id: uniqueId(label || `link-${entities.length + 1}`, usedEntityIds),
        label,
        href,
      };
    }

    const segments = body
      .split(SEGMENT_SPLIT)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    const name = segments.shift();
    if (!name) fail(lineNo, "Item is missing a name.");

    const product: Record<string, unknown> = {
      type: "product",
      id: "",
      name,
    };
    const badges: string[] = [];
    let explicitId: string | undefined;

    for (const segment of segments) {
      const qty = QTY_SEGMENT.exec(segment) ?? QTY_SHORT.exec(segment);
      if (qty) {
        sawQuantity = true;
        product.quantity = Number.parseInt(qty[1] ?? qty[2] ?? "1", 10);
        continue;
      }

      if (MONEY_SEGMENT.test(segment)) {
        product.displayPrice = segment;
        const amount = parseMoney(segment);
        if (amount !== undefined) {
          product.price = amount;
          product.currency = defaultCurrency;
        }
        continue;
      }

      if (URL_SEGMENT.test(segment)) {
        sawLink = true;
        product.productUrl = segment;
        continue;
      }

      const keyed = KEY_VALUE.exec(segment);
      if (keyed) {
        const key = keyed[1]!.toLowerCase();
        const value = keyed[2]!.trim();
        switch (key) {
          case "why":
          case "reason":
            product.reason = value;
            continue;
          case "store":
            product.store = value;
            continue;
          case "unit":
          case "unitprice":
            product.unitPrice = value;
            continue;
          case "size":
          case "pack":
          case "package":
            product.packageSize = value;
            continue;
          case "img":
          case "image":
            product.imageUrl = value;
            continue;
          case "badge":
          case "tag":
            badges.push(value);
            continue;
          case "avail":
          case "availability":
            product.availability = value;
            continue;
          case "id":
            explicitId = value;
            continue;
          case "price":
            product.displayPrice = value;
            if (MONEY_SEGMENT.test(value)) {
              const amount = parseMoney(value);
              if (amount !== undefined) {
                product.price = amount;
                product.currency = defaultCurrency;
              }
            }
            continue;
          default:
            fail(
              lineNo,
              `Unknown item field "${key}".`,
              "Supported: why, store, unit, size, img, badge, avail, id, price, qty.",
            );
        }
      }

      if (product.reason === undefined) {
        product.reason = segment;
        continue;
      }

      fail(
        lineNo,
        `Could not interpret "${segment}".`,
        "Separate fields with · and use forms like $4.29, qty 2, why: ..., https://...",
      );
    }

    if (badges.length) product.badges = badges;
    if (checked !== undefined) product.checked = checked;
    if (product.store === undefined && defaultStore) product.store = defaultStore;
    product.id = explicitId
      ? uniqueId(explicitId, usedEntityIds)
      : uniqueId(name, usedEntityIds);

    return product as unknown as MomentEntity;
  };

  lines.forEach((line, index) => {
    const lineNo = index + 1;
    const trimmed = line.trim();

    if (!trimmed) {
      inSummaryBlock = false;
      return;
    }
    if (trimmed.startsWith("//")) return;

    if (trimmed.startsWith("## ")) {
      inSummaryBlock = false;
      const label = trimmed.slice(3).trim();
      if (!label) fail(lineNo, "Group heading is empty.");
      const id = uniqueId(label, usedGroupIds);
      currentGroup = { id, label, entityIds: [] };
      groups.push(currentGroup);
      return;
    }

    if (trimmed.startsWith("# ")) {
      inSummaryBlock = false;
      if (title !== undefined) {
        fail(lineNo, "A second title was found.", "Use one '# Title' line per document.");
      }
      title = trimmed.slice(2).trim();
      return;
    }

    if (trimmed.startsWith("- ")) {
      const body = trimmed.slice(2).trim();

      if (inSummaryBlock) {
        const parts = body.split("|").map((part) => part.trim());
        if (parts.length < 2 || !parts[0] || !parts[1]) {
          fail(lineNo, "Summary rows need a label and a value.", "Use: - Label | Value");
        }
        summary.push({ label: parts[0]!, value: parts.slice(1).join(" | ") });
        return;
      }

      pushEntity(parseEntityLine(body, lineNo));
      return;
    }

    const keyed = KEY_VALUE.exec(trimmed);
    if (!keyed) {
      fail(
        lineNo,
        `Could not interpret "${trimmed}".`,
        "Lines start with '# ' (title), '## ' (group), '- ' (item), or 'key: value'.",
      );
    }

    const key = keyed[1]!.toLowerCase();
    const value = keyed[2]!.trim();
    inSummaryBlock = false;

    switch (key) {
      case "summary":
        if (value) fail(lineNo, "summary takes no inline value.", "Put each row on its own '- Label | Value' line.");
        inSummaryBlock = true;
        return;
      case "title":
        title = value;
        return;
      case "moment":
        if (!(MOMENT_TYPES as readonly string[]).includes(value)) {
          fail(lineNo, `Unknown moment "${value}".`, `Valid moments: ${MOMENT_TYPES.join(", ")}.`);
        }
        momentType = value;
        return;
      case "goal":
        goal = value;
        return;
      case "description":
        description = value;
        return;
      case "theme":
        if (value !== "system" && value !== "light" && value !== "dark") {
          fail(lineNo, `Unknown theme "${value}".`, "Valid themes: system, light, dark.");
        }
        theme = value;
        return;
      case "currency":
        defaultCurrency = value;
        return;
      case "store":
        defaultStore = value;
        return;
      case "continuation":
        continuation = value;
        return;
      case "affordances": {
        const tokens = value
          .split(",")
          .map((token) => token.trim())
          .filter(Boolean);
        for (const token of tokens) {
          if (!(AFFORDANCES as readonly string[]).includes(token)) {
            fail(lineNo, `Unknown affordance "${token}".`, `Valid affordances: ${AFFORDANCES.join(", ")}.`);
          }
        }
        declaredAffordances = [...new Set(tokens)] as Affordance[];
        return;
      }
      default:
        fail(
          lineNo,
          `Unknown document field "${key}".`,
          "Supported: title, moment, goal, description, theme, currency, store, continuation, affordances, summary.",
        );
    }
  });

  if (!title) {
    throw new DialectError(
      "This Juan dialect document could not be compiled.",
      "Missing title. Start the document with a '# Your title' line.",
    );
  }
  if (entities.length === 0) {
    throw new DialectError(
      "This Juan dialect document could not be compiled.",
      "No entities found. Add at least one '- Item name' line.",
    );
  }

  const inferred: Affordance[] = [];
  if (sawCheckbox) inferred.push("check");
  if (sawQuantity) inferred.push("adjust-qty");
  inferred.push("copy-list", "print", "reset");
  if (sawLink) inferred.push("open-links");

  const populatedGroups = groups.filter((group) => group.entityIds.length > 0);

  return validateMoment({
    version: "0.2",
    title,
    ...(description !== undefined ? { description } : {}),
    ...(theme !== undefined ? { theme } : {}),
    moment: momentType ?? "track",
    ...(goal !== undefined ? { goal } : {}),
    ...(summary.length ? { summary } : {}),
    entities,
    ...(populatedGroups.length ? { groups: populatedGroups } : {}),
    affordances: declaredAffordances ?? inferred,
    ...(continuation !== undefined
      ? { continuation: { kind: "note", text: continuation } }
      : {}),
  });
}

export function isDialectSource(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("{")) return false;
  return /^#\s+\S/m.test(trimmed) || /^moment\s*:/m.test(trimmed);
}
