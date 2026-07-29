/**
 * Fixed trusted catalogs. Agents may only emit these names; every pixel is
 * produced by the renderer, never by agent markup.
 */

/** Component catalog for JuanPager 0.1 documents. */
export const COMPONENT_TYPES = [
  "heading",
  "text",
  "image",
  "section",
  "grid",
  "card",
  "product",
  "price",
  "badge",
  "summary",
  "list",
  "checklist",
  "divider",
  "link",
  "button",
] as const;

export type ComponentType = (typeof COMPONENT_TYPES)[number];

export const BUTTON_ACTIONS = [
  "copy-page",
  "copy-list",
  "print-page",
  "reset-state",
  "open-all-links",
] as const;

/**
 * Moment types for JuanPager 0.2. A moment is the human intent at the end of
 * an agent conversation; it selects the composition, not the styling.
 */
export const MOMENT_TYPES = [
  "inspect",
  "choose",
  "confirm",
  "track",
  "compare",
  "collect",
  "browse",
] as const;

export type MomentType = (typeof MOMENT_TYPES)[number];

/** Entity kinds an agent may put in a moment's focus set. */
export const ENTITY_TYPES = ["product", "note", "link"] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

/**
 * Affordances are local capabilities the reader gets. They never describe
 * remote effects; nothing here can call out to a server.
 */
export const AFFORDANCES = [
  "check",
  "adjust-qty",
  "copy-list",
  "print",
  "reset",
  "open-links",
  "copy-page",
] as const;

export type Affordance = (typeof AFFORDANCES)[number];

/** Affordances rendered as toolbar buttons rather than per-entity controls. */
export const TOOLBAR_AFFORDANCES = [
  "copy-list",
  "print",
  "reset",
  "open-links",
  "copy-page",
] as const;

export const AFFORDANCE_LABELS: Record<Affordance, string> = {
  check: "Check off items",
  "adjust-qty": "Adjust quantities",
  "copy-list": "Copy list",
  print: "Print",
  reset: "Reset changes",
  "open-links": "Open all links",
  "copy-page": "Copy page link",
};

export const MOMENT_LABELS: Record<MomentType, string> = {
  inspect: "Inspect",
  choose: "Choose",
  confirm: "Confirm",
  track: "Track",
  compare: "Compare",
  collect: "Collect",
  browse: "Browse",
};
