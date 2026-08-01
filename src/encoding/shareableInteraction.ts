import {
  buildPageShareUrl,
  type MeaningSession,
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

function mutationLabel(mutation: readonly unknown[]): string {
  const opcode = Number(mutation[0]);
  if (opcode === 20) return `Set ${String(mutation[1])}.${String(mutation[2])}`;
  if (opcode === 21) return `Remove ${String(mutation[1])}.${String(mutation[2])}`;
  if (opcode === 22) return `Scope ${String(mutation[1])} = ${String(mutation[2])}`;
  if (opcode === 23) return `Clear scope ${String(mutation[1])}`;
  if (opcode === 24) {
    const values = Array.isArray(mutation[2]) ? mutation[2].map(String).join(", ") : "";
    return `Select ${String(mutation[1])}${values ? `: ${values}` : ""}`;
  }
  if (opcode >= 30 && opcode <= 34) return `Action ${String(mutation[3])}`;
  if (opcode === 35 || opcode === 36) return `Result ${String(mutation[2])}`;
  return `M1 mutation ${opcode}`;
}

export function interactionLedgerFromMeaningSession(session: MeaningSession): SharedInteractionEntry[] {
  const entries: SharedInteractionEntry[] = [];
  for (const [deltaIndex, delta] of session.deltas.entries()) {
    for (const [mutationIndex, mutation] of delta[4].entries()) {
      const cells = mutation as readonly unknown[];
      const timestamp = typeof cells[7] === "string"
        ? cells[7]
        : new Date(deltaIndex * 1000 + mutationIndex).toISOString();
      entries.push({
        id: `m1:${delta[2]}:${deltaIndex}:${mutationIndex}`,
        label: mutationLabel(cells),
        timestamp,
        patches: 1,
      });
    }
  }
  return entries.slice(-MAX_SHARED_INTERACTIONS);
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
  return [...merged.values()].slice(-MAX_SHARED_INTERACTIONS);
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
