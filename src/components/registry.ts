/**
 * Fixed trusted component catalog for JuanPager 0.1.
 * Agents may only emit these types; rendering is handled by the core renderer.
 */
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
