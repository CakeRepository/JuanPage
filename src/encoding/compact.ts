import type { JuanPagerComponent, JuanPagerDocument } from "../schema/document.js";

type CompactValue = string | number | boolean | null | CompactObject | CompactValue[];
type CompactObject = { [key: string]: CompactValue };

const TYPE_TO_SHORT: Record<string, string> = {
  heading: "h",
  text: "x",
  image: "i",
  section: "s",
  grid: "g",
  card: "c",
  product: "p",
  price: "pr",
  badge: "b",
  summary: "sm",
  list: "l",
  checklist: "cl",
  divider: "d",
  link: "lk",
  button: "btn",
};

const SHORT_TO_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_TO_SHORT).map(([k, v]) => [v, k]),
);

const FIELD_TO_SHORT: Record<string, string> = {
  version: "v",
  title: "ti",
  description: "de",
  theme: "th",
  components: "cs",
  metadata: "m",
  type: "t",
  id: "id",
  text: "tx",
  level: "lv",
  src: "src",
  alt: "alt",
  caption: "cap",
  name: "n",
  store: "s",
  imageUrl: "iu",
  displayPrice: "dp",
  price: "pc",
  currency: "cu",
  unitPrice: "up",
  packageSize: "ps",
  quantity: "q",
  availability: "av",
  productUrl: "pu",
  reason: "r",
  badges: "bd",
  checked: "ck",
  amount: "am",
  label: "lb",
  tone: "tn",
  items: "it",
  value: "vl",
  ordered: "or",
  href: "hr",
  action: "ac",
  variant: "vt",
  collapsible: "co",
  collapsed: "cd",
  columns: "cols",
};

const SHORT_TO_FIELD: Record<string, string> = Object.fromEntries(
  Object.entries(FIELD_TO_SHORT).map(([k, v]) => [v, k]),
);

function compactComponent(component: JuanPagerComponent): CompactObject {
  const out: CompactObject = {};
  for (const [key, value] of Object.entries(component)) {
    if (value === undefined) continue;
    const shortKey = FIELD_TO_SHORT[key];
    if (!shortKey) {
      throw new Error(`Unknown field during compact encoding: ${key}`);
    }
    if (key === "type" && typeof value === "string") {
      const shortType = TYPE_TO_SHORT[value];
      if (!shortType) throw new Error(`Unknown component type: ${value}`);
      out[shortKey] = shortType;
      continue;
    }
    if (key === "components" && Array.isArray(value)) {
      out[shortKey] = value.map((child) => compactComponent(child as JuanPagerComponent));
      continue;
    }
    out[shortKey] = value as CompactValue;
  }
  return out;
}

function expandComponent(input: CompactObject): JuanPagerComponent {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const field = SHORT_TO_FIELD[key];
    if (!field) {
      throw new Error(`Unknown compact field: ${key}`);
    }
    if (field === "type" && typeof value === "string") {
      const type = SHORT_TO_TYPE[value] ?? value;
      out[field] = type;
      continue;
    }
    if (field === "components" && Array.isArray(value)) {
      out[field] = value.map((child) => expandComponent(child as CompactObject));
      continue;
    }
    out[field] = value;
  }
  return out as JuanPagerComponent;
}

export function toCompactDocument(document: JuanPagerDocument): CompactObject {
  return {
    [FIELD_TO_SHORT.version!]: document.version,
    [FIELD_TO_SHORT.title!]: document.title,
    ...(document.description !== undefined
      ? { [FIELD_TO_SHORT.description!]: document.description }
      : {}),
    ...(document.theme !== undefined ? { [FIELD_TO_SHORT.theme!]: document.theme } : {}),
    [FIELD_TO_SHORT.components!]: document.components.map(compactComponent),
    ...(document.metadata !== undefined
      ? { [FIELD_TO_SHORT.metadata!]: document.metadata }
      : {}),
  };
}

export function fromCompactDocument(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Compact document must be an object");
  }
  const obj = input as CompactObject;
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const field = SHORT_TO_FIELD[key] ?? key;
    if (field === "components" && Array.isArray(value)) {
      out.components = value.map((child) => expandComponent(child as CompactObject));
      continue;
    }
    out[field] = value;
  }

  return out;
}

export { TYPE_TO_SHORT, SHORT_TO_TYPE, FIELD_TO_SHORT, SHORT_TO_FIELD };
