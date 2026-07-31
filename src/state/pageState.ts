import type { JuanPageDocument, PageLens, PageObject, PageScalar } from "../schema/page.js";
import { objectField } from "../schema/page.js";

export type PageState = {
  values: Record<string, Record<string, PageScalar>>;
  lens?: PageLens;
  selectedId?: string;
  activeGroup?: string;
};

const EMPTY_STATE: PageState = { values: {} };

function hashText(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function pageStateKey(page: JuanPageDocument): string {
  return `juanpager:1:${hashText(JSON.stringify(page))}`;
}

export function loadPageState(key: string): PageState {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...EMPTY_STATE, values: {} };
    const parsed = JSON.parse(raw) as Partial<PageState>;
    return {
      values: parsed.values && typeof parsed.values === "object" ? parsed.values : {},
      lens: parsed.lens,
      selectedId: parsed.selectedId,
      activeGroup: parsed.activeGroup,
    };
  } catch {
    return { ...EMPTY_STATE, values: {} };
  }
}

export function savePageState(key: string, state: PageState): void {
  localStorage.setItem(key, JSON.stringify(state));
}

export function resetPageState(key: string): void {
  localStorage.removeItem(key);
}

export function effectiveFieldValue(
  object: PageObject,
  fieldKey: string,
  state: PageState,
  fallback?: PageScalar,
): PageScalar | PageScalar[] | undefined {
  const override = state.values[object.id]?.[fieldKey];
  if (override !== undefined) return override;
  return objectField(object, fieldKey)?.value ?? fallback;
}

export function setPageValue(
  state: PageState,
  target: string,
  field: string,
  value: PageScalar,
): void {
  state.values[target] = { ...state.values[target], [field]: value };
}
