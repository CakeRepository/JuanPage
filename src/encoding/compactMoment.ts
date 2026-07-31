import type {
  JuanPagerMomentDoc,
  MomentEntity,
  MomentGroup,
  MomentSummaryItem,
} from "../schema/moment.js";

type CompactValue = string | number | boolean | null | CompactObject | CompactValue[];
type CompactObject = { [key: string]: CompactValue };

const MOMENT_FIELD_TO_SHORT: Record<string, string> = {
  version: "v",
  title: "ti",
  description: "de",
  theme: "th",
  moment: "mo",
  goal: "go",
  summary: "su",
  entities: "en",
  groups: "gr",
  affordances: "af",
  continuation: "cn",
  metadata: "m",
  type: "t",
  id: "id",
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
  text: "tx",
  label: "lb",
  href: "hr",
  value: "vl",
  entityIds: "ei",
  kind: "k",
};

const SHORT_TO_MOMENT_FIELD: Record<string, string> = Object.fromEntries(
  Object.entries(MOMENT_FIELD_TO_SHORT).map(([long, short]) => [short, long]),
);

const LONG_MOMENT_FIELDS = new Set(Object.keys(MOMENT_FIELD_TO_SHORT));

const ENTITY_TYPE_TO_SHORT: Record<string, string> = {
  product: "p",
  note: "nt",
  link: "lk",
};

const MOMENT_TYPE_TO_SHORT: Record<string, string> = {
  inspect: "in",
  choose: "ch",
  confirm: "cf",
  track: "tr",
  compare: "cm",
  collect: "co",
  browse: "br",
};

const AFFORDANCE_TO_SHORT: Record<string, string> = {
  check: "ck",
  "adjust-qty": "aq",
  "copy-list": "cl",
  print: "pr",
  reset: "rs",
  "open-links": "ol",
  "copy-page": "cp",
  return: "rt",
};

const CONTINUATION_KIND_TO_SHORT: Record<string, string> = {
  none: "n",
  note: "nt",
};

function invert(map: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(map).map(([long, short]) => [short, long]));
}

const SHORT_TO_ENTITY_TYPE = invert(ENTITY_TYPE_TO_SHORT);
const SHORT_TO_MOMENT_TYPE = invert(MOMENT_TYPE_TO_SHORT);
const SHORT_TO_AFFORDANCE = invert(AFFORDANCE_TO_SHORT);
const SHORT_TO_CONTINUATION_KIND = invert(CONTINUATION_KIND_TO_SHORT);

function shortKey(key: string): string {
  const short = MOMENT_FIELD_TO_SHORT[key];
  if (!short) throw new Error(`Unknown field during compact encoding: ${key}`);
  return short;
}

/**
 * Accepts both compact keys and readable keys so `enc=raw` payloads (plain
 * JSON) and `enc=gz` payloads (compact JSON) share one expansion path.
 */
function longKey(key: string): string {
  const long = SHORT_TO_MOMENT_FIELD[key];
  if (long) return long;
  if (LONG_MOMENT_FIELDS.has(key)) return key;
  throw new Error(`Unknown compact field: ${key}`);
}

function compactEntity(entity: MomentEntity): CompactObject {
  const out: CompactObject = {};
  for (const [key, value] of Object.entries(entity)) {
    if (value === undefined) continue;
    if (key === "type" && typeof value === "string") {
      out[shortKey(key)] = ENTITY_TYPE_TO_SHORT[value] ?? value;
      continue;
    }
    out[shortKey(key)] = value as CompactValue;
  }
  return out;
}

function expandEntity(input: CompactObject): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const field = longKey(key);
    if (field === "type" && typeof value === "string") {
      out[field] = SHORT_TO_ENTITY_TYPE[value] ?? value;
      continue;
    }
    out[field] = value;
  }
  return out;
}

function compactGroup(group: MomentGroup): CompactObject {
  return {
    [shortKey("id")]: group.id,
    [shortKey("label")]: group.label,
    [shortKey("entityIds")]: group.entityIds,
  };
}

function compactSummaryItem(item: MomentSummaryItem): CompactObject {
  return {
    [shortKey("label")]: item.label,
    [shortKey("value")]: item.value,
  };
}

function expandPlainObject(input: CompactObject): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    out[longKey(key)] = value;
  }
  return out;
}

function expandContinuation(input: CompactObject): Record<string, unknown> {
  const out = expandPlainObject(input);
  if (typeof out.kind === "string") {
    out.kind = SHORT_TO_CONTINUATION_KIND[out.kind] ?? out.kind;
  }
  return out;
}

export function toCompactMoment(moment: JuanPagerMomentDoc): CompactObject {
  const out: CompactObject = {
    [shortKey("version")]: moment.version,
    [shortKey("title")]: moment.title,
    [shortKey("moment")]: MOMENT_TYPE_TO_SHORT[moment.moment] ?? moment.moment,
  };

  if (moment.description !== undefined) out[shortKey("description")] = moment.description;
  if (moment.theme !== undefined) out[shortKey("theme")] = moment.theme;
  if (moment.goal !== undefined) out[shortKey("goal")] = moment.goal;
  if (moment.summary !== undefined) {
    out[shortKey("summary")] = moment.summary.map(compactSummaryItem);
  }

  out[shortKey("entities")] = moment.entities.map(compactEntity);

  if (moment.groups !== undefined) {
    out[shortKey("groups")] = moment.groups.map(compactGroup);
  }

  out[shortKey("affordances")] = moment.affordances.map(
    (affordance) => AFFORDANCE_TO_SHORT[affordance] ?? affordance,
  );

  if (moment.continuation !== undefined) {
    const continuation: CompactObject = {
      [shortKey("kind")]:
        CONTINUATION_KIND_TO_SHORT[moment.continuation.kind] ?? moment.continuation.kind,
    };
    if ("text" in moment.continuation) {
      continuation[shortKey("text")] = moment.continuation.text;
    }
    out[shortKey("continuation")] = continuation;
  }

  if (moment.metadata !== undefined) {
    out[shortKey("metadata")] = moment.metadata as CompactObject;
  }

  return out;
}

export function fromCompactMoment(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Compact moment must be an object");
  }

  const obj = input as CompactObject;
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const field = longKey(key);

    if (field === "moment" && typeof value === "string") {
      out.moment = SHORT_TO_MOMENT_TYPE[value] ?? value;
      continue;
    }
    if (field === "entities" && Array.isArray(value)) {
      out.entities = value.map((entity) => expandEntity(entity as CompactObject));
      continue;
    }
    if (field === "groups" && Array.isArray(value)) {
      out.groups = value.map((group) => expandPlainObject(group as CompactObject));
      continue;
    }
    if (field === "summary" && Array.isArray(value)) {
      out.summary = value.map((item) => expandPlainObject(item as CompactObject));
      continue;
    }
    if (field === "affordances" && Array.isArray(value)) {
      out.affordances = value.map((affordance) =>
        typeof affordance === "string"
          ? SHORT_TO_AFFORDANCE[affordance] ?? affordance
          : affordance,
      );
      continue;
    }
    if (field === "continuation" && value && typeof value === "object") {
      out.continuation = expandContinuation(value as CompactObject);
      continue;
    }

    out[field] = value;
  }

  return out;
}

export {
  MOMENT_FIELD_TO_SHORT,
  SHORT_TO_MOMENT_FIELD,
  ENTITY_TYPE_TO_SHORT,
  MOMENT_TYPE_TO_SHORT,
  AFFORDANCE_TO_SHORT,
};
