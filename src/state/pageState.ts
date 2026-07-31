import {
  objectField,
  type JuanPageDocument,
  type PageBindingTarget,
  type PageObject,
  type PageScalar,
} from "../schema/page.js";

export type PageState = {
  values: Record<string, Record<string, PageScalar>>;
  scopes: Record<string, PageScalar>;
  selections: Record<string, string[]>;
  inspection?: PageBindingTarget;
  activeGroup?: string;
};

export type PageInteractionMutation =
  | Readonly<{ kind: "set"; target: string; field: string; value: PageScalar }>
  | Readonly<{ kind: "scope"; scope: string; value: PageScalar }>
  | Readonly<{ kind: "select"; selection: string; values: readonly string[] }>;

function initialState(page: JuanPageDocument): PageState {
  const scopes: Record<string, PageScalar> = {};
  for (const scope of page.scopes ?? []) if (scope.initial !== undefined) scopes[scope.id] = scope.initial;
  Object.assign(scopes, page.state?.scopes ?? {});
  return {
    values: {},
    scopes,
    selections: Object.fromEntries(
      Object.entries(page.state?.selections ?? {}).map(([name, values]) => [name, [...values]]),
    ),
  };
}

function hashText(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function pageStateKey(page: JuanPageDocument): string {
  return `juanpager:2:${hashText(JSON.stringify(page))}`;
}

export function loadPageState(key: string, page: JuanPageDocument): PageState {
  const fallback = initialState(page);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PageState>;
    return {
      values: parsed.values && typeof parsed.values === "object" ? parsed.values : {},
      scopes: parsed.scopes && typeof parsed.scopes === "object" ? { ...fallback.scopes, ...parsed.scopes } : fallback.scopes,
      selections: parsed.selections && typeof parsed.selections === "object"
        ? Object.fromEntries(Object.entries(parsed.selections).map(([name, values]) => [name, Array.isArray(values) ? values.map(String) : []]))
        : fallback.selections,
      inspection: parsed.inspection && typeof parsed.inspection === "object" ? parsed.inspection : undefined,
      activeGroup: typeof parsed.activeGroup === "string" ? parsed.activeGroup : undefined,
    };
  } catch {
    return fallback;
  }
}

export function savePageState(key: string, state: PageState): void {
  localStorage.setItem(key, JSON.stringify(state));
}

export function resetPageState(key: string): void {
  localStorage.removeItem(key);
}

function emit(mutation: PageInteractionMutation): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<PageInteractionMutation>("juanpager:interaction", { detail: mutation }));
  }
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

export function setPageValue(state: PageState, target: string, field: string, value: PageScalar): void {
  state.values[target] = { ...state.values[target], [field]: value };
  emit({ kind: "set", target, field, value });
}

export function setPageScope(state: PageState, scope: string, value: PageScalar): void {
  if (value === null) delete state.scopes[scope];
  else state.scopes[scope] = value;
  emit({ kind: "scope", scope, value });
}

export function setPageSelection(state: PageState, selection: string, values: readonly string[]): void {
  state.selections[selection] = [...new Set(values)];
  emit({ kind: "select", selection, values: state.selections[selection] });
}
