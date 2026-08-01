import {
  objectField,
  type JuanPageDocument,
  type PageBindingTarget,
  type PageObject,
  type PageScalar,
  type PageValue,
} from "../schema/page.js";
import {
  cloneInteractionValue,
  pageInteractionStateSchema,
  type PageClockState,
  type PageInteractionDomain,
  type PageInteractionValue,
  type PageViewportState,
} from "../schema/interaction.js";

export type PageValuePatch = Readonly<{
  domain: "value";
  target: string;
  field: string;
  before?: PageScalar;
  after?: PageScalar;
}>;
export type PageScopePatch = Readonly<{
  domain: "scope";
  key: string;
  before?: PageScalar;
  after?: PageScalar;
}>;
export type PageSelectionPatch = Readonly<{
  domain: "selection";
  key: string;
  before?: readonly string[];
  after?: readonly string[];
}>;
export type PageSemanticStatePatch = Readonly<{
  domain: "interaction";
  state: PageInteractionDomain;
  key: string;
  before?: PageInteractionValue;
  after?: PageInteractionValue;
}>;
export type PageStatePatch = PageValuePatch | PageScopePatch | PageSelectionPatch | PageSemanticStatePatch;
export type PageTransaction = Readonly<{
  id: string;
  label: string;
  timestamp: string;
  patches: readonly PageStatePatch[];
}>;
export type PageTransactionAction = "commit" | "cancel" | "undo" | "redo";

export class PageTransactionConflictError extends Error {
  constructor(
    readonly transactionId: string,
    readonly patchIndex: number,
    readonly expected: unknown,
    readonly actual: unknown,
  ) {
    super(`Transaction ${transactionId} conflicted at patch ${patchIndex}.`);
    this.name = "PageTransactionConflictError";
  }
}

export type PageState = {
  values: Record<string, Record<string, PageScalar>>;
  scopes: Record<string, PageScalar>;
  selections: Record<string, string[]>;
  expansions: Record<string, string[]>;
  paths: Record<string, string[]>;
  viewports: Record<string, PageViewportState>;
  ranges: Record<string, PageValue>;
  playheads: Record<string, number>;
  ordering: Record<string, string[]>;
  groupings: Record<string, string>;
  focus?: string;
  clocks: Record<string, PageClockState>;
  history: PageTransaction[];
  future: PageTransaction[];
  inspection?: PageBindingTarget;
  activeGroup?: string;
};

export type PageInteractionMutation =
  | Readonly<{ kind: "set"; target: string; field: string; value: PageScalar }>
  | Readonly<{ kind: "scope"; scope: string; value: PageScalar }>
  | Readonly<{ kind: "select"; selection: string; values: readonly string[] }>
  | Readonly<{ kind: "state"; state: PageInteractionDomain; key: string; value?: PageInteractionValue }>
  | Readonly<{ kind: "transaction"; transactionId: string; action: PageTransactionAction; patches: readonly PageStatePatch[] }>;

let transactionSequence = 0;

function cloneStrings(values: readonly string[] | undefined): string[] {
  return values ? [...values] : [];
}

function initialState(page: JuanPageDocument): PageState {
  const scopes: Record<string, PageScalar> = {};
  for (const scope of page.scopes ?? []) if (scope.initial !== undefined) scopes[scope.id] = scope.initial;
  Object.assign(scopes, page.state?.scopes ?? {});
  return {
    values: {},
    scopes,
    selections: Object.fromEntries(Object.entries(page.state?.selections ?? {}).map(([name, values]) => [name, [...values]])),
    expansions: Object.fromEntries(Object.entries(page.state?.expansions ?? {}).map(([name, values]) => [name, [...values]])),
    paths: Object.fromEntries(Object.entries(page.state?.paths ?? {}).map(([name, values]) => [name, [...values]])),
    viewports: structuredClone(page.state?.viewports ?? {}),
    ranges: structuredClone(page.state?.ranges ?? {}),
    playheads: { ...(page.state?.playheads ?? {}) },
    ordering: Object.fromEntries(Object.entries(page.state?.ordering ?? {}).map(([name, values]) => [name, [...values]])),
    groupings: { ...(page.state?.groupings ?? {}) },
    focus: page.state?.focus,
    clocks: structuredClone(page.state?.clocks ?? {}),
    history: [],
    future: [],
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

function transactionId(): string {
  transactionSequence += 1;
  return `tx:${Date.now().toString(36)}:${transactionSequence.toString(36)}`;
}

function interactionSnapshot(state: Partial<PageState>): Record<string, unknown> {
  return {
    scopes: state.scopes,
    selections: state.selections,
    expansions: state.expansions,
    paths: state.paths,
    viewports: state.viewports,
    ranges: state.ranges,
    playheads: state.playheads,
    ordering: state.ordering,
    groupings: state.groupings,
    focus: state.focus,
    clocks: state.clocks,
  };
}

function validTransactions(value: unknown): PageTransaction[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is PageTransaction => Boolean(
    entry
    && typeof entry === "object"
    && typeof (entry as PageTransaction).id === "string"
    && typeof (entry as PageTransaction).label === "string"
    && typeof (entry as PageTransaction).timestamp === "string"
    && Array.isArray((entry as PageTransaction).patches),
  )).slice(-50);
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
    const interaction = pageInteractionStateSchema.safeParse(interactionSnapshot(parsed));
    const restored = interaction.success ? interaction.data : {};
    return {
      values: parsed.values && typeof parsed.values === "object" ? parsed.values : {},
      scopes: { ...fallback.scopes, ...(restored.scopes ?? {}) },
      selections: Object.fromEntries(Object.entries(restored.selections ?? fallback.selections).map(([name, values]) => [name, [...values]])),
      expansions: Object.fromEntries(Object.entries(restored.expansions ?? fallback.expansions).map(([name, values]) => [name, [...values]])),
      paths: Object.fromEntries(Object.entries(restored.paths ?? fallback.paths).map(([name, values]) => [name, [...values]])),
      viewports: structuredClone(restored.viewports ?? fallback.viewports),
      ranges: structuredClone(restored.ranges ?? fallback.ranges),
      playheads: { ...fallback.playheads, ...(restored.playheads ?? {}) },
      ordering: Object.fromEntries(Object.entries(restored.ordering ?? fallback.ordering).map(([name, values]) => [name, [...values]])),
      groupings: { ...fallback.groupings, ...(restored.groupings ?? {}) },
      focus: restored.focus ?? fallback.focus,
      clocks: structuredClone(restored.clocks ?? fallback.clocks),
      history: validTransactions(parsed.history),
      future: validTransactions(parsed.future),
      inspection: parsed.inspection && typeof parsed.inspection === "object" ? parsed.inspection : undefined,
      activeGroup: typeof parsed.activeGroup === "string" ? parsed.activeGroup : undefined,
    };
  } catch {
    return fallback;
  }
}

export function savePageState(key: string, state: PageState): void {
  localStorage.setItem(key, JSON.stringify({ ...state, history: state.history.slice(-50), future: state.future.slice(-50) }));
}

export function resetPageState(key: string): void {
  localStorage.removeItem(key);
}

function emit(mutation: PageInteractionMutation): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<PageInteractionMutation>("juanpager:interaction", { detail: mutation }));
  }
}

function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function interactionRecord(state: PageState, domain: Exclude<PageInteractionDomain, "focus">): Record<string, PageInteractionValue> {
  return state[domain] as Record<string, PageInteractionValue>;
}

function interactionValue(state: PageState, domain: PageInteractionDomain, key: string): PageInteractionValue | undefined {
  if (domain === "focus") return state.focus;
  return cloneInteractionValue(interactionRecord(state, domain)[key]);
}

function patchValue(state: PageState, patch: PageStatePatch): unknown {
  if (patch.domain === "value") return state.values[patch.target]?.[patch.field];
  if (patch.domain === "scope") return state.scopes[patch.key];
  if (patch.domain === "selection") return state.selections[patch.key];
  return interactionValue(state, patch.state, patch.key);
}

function assertPatchPrecondition(
  state: PageState,
  transaction: PageTransaction,
  patch: PageStatePatch,
  side: "before" | "after",
  index: number,
): void {
  const expected = patch[side];
  const actual = patchValue(state, patch);
  if (!equal(expected, actual)) throw new PageTransactionConflictError(transaction.id, index, expected, actual);
}

function applyPatch(state: PageState, patch: PageStatePatch, side: "before" | "after"): void {
  if (patch.domain === "value") {
    const value = patch[side];
    if (value === undefined) {
      const current = { ...(state.values[patch.target] ?? {}) };
      delete current[patch.field];
      if (Object.keys(current).length) state.values[patch.target] = current;
      else delete state.values[patch.target];
    } else state.values[patch.target] = { ...(state.values[patch.target] ?? {}), [patch.field]: value };
    return;
  }
  if (patch.domain === "scope") {
    const value = patch[side];
    if (value === undefined || value === null) delete state.scopes[patch.key];
    else state.scopes[patch.key] = value;
    return;
  }
  if (patch.domain === "selection") {
    const value = patch[side];
    if (value === undefined) delete state.selections[patch.key];
    else state.selections[patch.key] = [...value];
    return;
  }
  const value = patch[side];
  if (patch.state === "focus") {
    state.focus = typeof value === "string" ? value : undefined;
    return;
  }
  const record = interactionRecord(state, patch.state);
  if (value === undefined) delete record[patch.key];
  else record[patch.key] = cloneInteractionValue(value)!;
}

export function createPageTransaction(label: string, patches: readonly PageStatePatch[]): PageTransaction {
  if (!patches.length) throw new Error("A page transaction requires at least one patch.");
  return { id: transactionId(), label, timestamp: new Date().toISOString(), patches: structuredClone(patches) };
}

export function commitPageTransaction(
  state: PageState,
  transaction: PageTransaction,
  emitMutation = true,
): PageTransaction {
  transaction.patches.forEach((patch, index) => assertPatchPrecondition(state, transaction, patch, "before", index));
  for (const patch of transaction.patches) applyPatch(state, patch, "after");
  state.history.push(transaction);
  state.history = state.history.slice(-50);
  state.future = [];
  if (emitMutation) emit({ kind: "transaction", transactionId: transaction.id, action: "commit", patches: transaction.patches });
  return transaction;
}

export function cancelPageTransaction(transaction: PageTransaction): PageTransaction {
  emit({ kind: "transaction", transactionId: transaction.id, action: "cancel", patches: transaction.patches });
  return transaction;
}

function commitSingle(state: PageState, label: string, patch: PageStatePatch, mutation: PageInteractionMutation): void {
  const transaction = createPageTransaction(label, [patch]);
  commitPageTransaction(state, transaction, false);
  emit(mutation);
}

export function effectiveFieldValue(
  object: PageObject,
  fieldKey: string,
  state: PageState,
  fallback?: PageScalar,
): PageValue | undefined {
  const override = state.values[object.id]?.[fieldKey];
  if (override !== undefined) return override;
  return objectField(object, fieldKey)?.value ?? fallback;
}

export function effectivePageObjects(page: JuanPageDocument, state: PageState): PageObject[] {
  return page.objects.map((object) => ({
    ...object,
    fields: object.fields?.map((field) => ({ ...field, value: effectiveFieldValue(object, field.key, state) ?? null })),
  }));
}

export function setPageValue(state: PageState, target: string, field: string, value: PageScalar, label = `Set ${field}`): void {
  const before = state.values[target]?.[field];
  if (equal(before, value)) return;
  commitSingle(state, label, { domain: "value", target, field, before, after: value }, { kind: "set", target, field, value });
}

export function setPageScope(state: PageState, scope: string, value: PageScalar, label = `Scope ${scope}`): void {
  const before = state.scopes[scope];
  const after = value === null ? undefined : value;
  if (equal(before, after)) return;
  commitSingle(state, label, { domain: "scope", key: scope, before, after }, { kind: "scope", scope, value });
}

export function setPageSelection(state: PageState, selection: string, values: readonly string[], label = `Select ${selection}`): void {
  const before = state.selections[selection] === undefined ? undefined : cloneStrings(state.selections[selection]);
  const after = [...new Set(values)];
  if (equal(before, after)) return;
  commitSingle(state, label, { domain: "selection", key: selection, before, after }, { kind: "select", selection, values: after });
}

export function setPageInteractionState(
  state: PageState,
  domain: PageInteractionDomain,
  key: string,
  value: PageInteractionValue | undefined,
  label = `Set ${domain}`,
  focusAnchor?: string,
): void {
  const before = interactionValue(state, domain, key);
  const after = cloneInteractionValue(value);
  const statePatch: PageSemanticStatePatch = { domain: "interaction", state: domain, key, before, after };
  if (!focusAnchor) {
    if (equal(before, after)) return;
    commitSingle(state, label, statePatch, { kind: "state", state: domain, key, value: after });
    return;
  }
  const patches: PageStatePatch[] = [];
  if (!equal(before, after)) patches.push(statePatch);
  if (!equal(state.focus, focusAnchor)) patches.push({
    domain: "interaction",
    state: "focus",
    key: "active",
    before: state.focus,
    after: focusAnchor,
  });
  if (!patches.length) return;
  commitPageTransaction(state, createPageTransaction(label, patches));
}

export function setPageFocus(state: PageState, anchor: string | undefined): void {
  if (anchor?.startsWith("history:")) return;
  state.focus = anchor;
}

export function canUndoPageState(state: PageState): boolean {
  return state.history.length > 0;
}

export function canRedoPageState(state: PageState): boolean {
  return state.future.length > 0;
}

export function undoPageTransaction(state: PageState): PageTransaction | undefined {
  const transaction = state.history.at(-1);
  if (!transaction) return undefined;
  transaction.patches.forEach((patch, index) => assertPatchPrecondition(state, transaction, patch, "after", index));
  state.history.pop();
  for (const patch of [...transaction.patches].reverse()) applyPatch(state, patch, "before");
  state.future.push(transaction);
  emit({ kind: "transaction", transactionId: transaction.id, action: "undo", patches: transaction.patches });
  return transaction;
}

export function redoPageTransaction(state: PageState): PageTransaction | undefined {
  const transaction = state.future.at(-1);
  if (!transaction) return undefined;
  transaction.patches.forEach((patch, index) => assertPatchPrecondition(state, transaction, patch, "before", index));
  state.future.pop();
  for (const patch of transaction.patches) applyPatch(state, patch, "after");
  state.history.push(transaction);
  emit({ kind: "transaction", transactionId: transaction.id, action: "redo", patches: transaction.patches });
  return transaction;
}

export function pageInteractionSnapshot(state: PageState): import("../schema/interaction.js").PageInteractionState {
  return {
    scopes: { ...state.scopes },
    selections: Object.fromEntries(Object.entries(state.selections).map(([key, values]) => [key, [...values]])),
    expansions: Object.fromEntries(Object.entries(state.expansions).map(([key, values]) => [key, [...values]])),
    paths: Object.fromEntries(Object.entries(state.paths).map(([key, values]) => [key, [...values]])),
    viewports: structuredClone(state.viewports),
    ranges: structuredClone(state.ranges),
    playheads: { ...state.playheads },
    ordering: Object.fromEntries(Object.entries(state.ordering).map(([key, values]) => [key, [...values]])),
    groupings: { ...state.groupings },
    focus: state.focus,
    clocks: structuredClone(state.clocks),
  };
}
