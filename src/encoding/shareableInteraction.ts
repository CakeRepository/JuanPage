import {
  buildPageShareUrl,
  type PagePayloadEncoding,
} from "./pagePipeline.js";
import {
  validatePage,
  type JuanPageDocument,
} from "../schema/page.js";
import { LIMITS } from "../schema/limits.js";
import {
  effectivePageObjects,
  pageInteractionSnapshot,
  type PageState,
  type PageTransaction,
} from "../state/pageState.js";

export const INTERACTION_LEDGER_METADATA_KEY = "juanpager.interactionLedger";
export const INTERACTION_COUNT_METADATA_KEY = "juanpager.interactionCount";
export const INTERACTION_SHARE_MODE_METADATA_KEY = "juanpager.shareMode";
export const MAX_SHARED_INTERACTIONS = 20;

export type SharedInteractionEntry = Readonly<{
  id: string;
  label: string;
  timestamp: string;
  patches: number;
}>;

function validEntry(value: unknown): value is SharedInteractionEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<SharedInteractionEntry>;
  return typeof entry.id === "string"
    && typeof entry.label === "string"
    && typeof entry.timestamp === "string"
    && typeof entry.patches === "number"
    && Number.isInteger(entry.patches)
    && entry.patches >= 0;
}

function transactionEntry(transaction: PageTransaction): SharedInteractionEntry {
  return {
    id: transaction.id,
    label: transaction.label,
    timestamp: transaction.timestamp,
    patches: transaction.patches.length,
  };
}

function encodedLedger(entries: readonly SharedInteractionEntry[]): string {
  let bounded = [...entries].slice(-MAX_SHARED_INTERACTIONS);
  let encoded = JSON.stringify(bounded);
  while (encoded.length > LIMITS.maxTextLength && bounded.length > 1) {
    bounded = bounded.slice(1);
    encoded = JSON.stringify(bounded);
  }
  return encoded;
}

export function interactionLedgerFromPage(page: JuanPageDocument): SharedInteractionEntry[] {
  const encoded = page.metadata?.[INTERACTION_LEDGER_METADATA_KEY];
  if (typeof encoded !== "string") return [];
  try {
    const parsed = JSON.parse(encoded) as unknown;
    return Array.isArray(parsed) ? parsed.filter(validEntry).slice(-MAX_SHARED_INTERACTIONS) : [];
  } catch {
    return [];
  }
}

export function sharedInteractionLedger(
  page: JuanPageDocument,
  state: PageState,
  activity: readonly SharedInteractionEntry[] = [],
): SharedInteractionEntry[] {
  const merged = new Map<string, SharedInteractionEntry>();
  for (const entry of interactionLedgerFromPage(page)) merged.set(entry.id, entry);
  const current = activity.length ? activity : state.history.map(transactionEntry);
  for (const entry of current) merged.set(entry.id, entry);
  return [...merged.values()]
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .slice(-MAX_SHARED_INTERACTIONS);
}

export function pageWithSharedInteractionState(
  page: JuanPageDocument,
  state: PageState,
  activity: readonly SharedInteractionEntry[] = [],
): JuanPageDocument {
  const ledger = sharedInteractionLedger(page, state, activity);
  const encoded = encodedLedger(ledger);
  const persistedLedger = JSON.parse(encoded) as SharedInteractionEntry[];
  return validatePage({
    ...page,
    objects: effectivePageObjects(page, state),
    state: pageInteractionSnapshot(state),
    metadata: {
      ...(page.metadata ?? {}),
      [INTERACTION_LEDGER_METADATA_KEY]: encoded,
      [INTERACTION_COUNT_METADATA_KEY]: persistedLedger.length,
      [INTERACTION_SHARE_MODE_METADATA_KEY]: "state-and-ledger",
    },
  });
}

export async function buildInteractivePageShareUrl(
  page: JuanPageDocument,
  state: PageState,
  baseUrl: string,
  encoding: PagePayloadEncoding = "gz",
  activity: readonly SharedInteractionEntry[] = [],
): Promise<string> {
  return buildPageShareUrl(pageWithSharedInteractionState(page, state, activity), baseUrl, encoding);
}
