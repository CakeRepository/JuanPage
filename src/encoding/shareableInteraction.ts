import {
  buildPageShareUrl,
  type MeaningSession,
  type PagePayloadEncoding,
} from "./pagePipeline.js";
import {
  validatePage,
  type JuanPageDocument,
} from "../schema/page.js";
import {
  effectivePageObjects,
  pageInteractionSnapshot,
  type PageState,
} from "../state/pageState.js";
import {
  encodeInteractionLedger,
  interactionLedgerFromMeaningDeltas,
  INTERACTION_COUNT_METADATA_KEY,
  INTERACTION_LEDGER_METADATA_KEY,
  INTERACTION_SHARE_MODE_METADATA_KEY,
  sharedInteractionLedger,
  withInteractionLedgerObject,
  type SharedInteractionEntry,
} from "../interaction/ledger.js";

export * from "../interaction/ledger.js";

export function interactionLedgerFromMeaningSession(session: MeaningSession): SharedInteractionEntry[] {
  return interactionLedgerFromMeaningDeltas(session.deltas);
}

export function pageWithSharedInteractionState(
  page: JuanPageDocument,
  state: PageState,
  activity: readonly SharedInteractionEntry[] = [],
): JuanPageDocument {
  const ledger = sharedInteractionLedger(page, state, activity);
  const encoded = encodeInteractionLedger(ledger);
  const persistedLedger = JSON.parse(encoded) as SharedInteractionEntry[];
  return validatePage({
    ...page,
    objects: withInteractionLedgerObject(effectivePageObjects(page, state), persistedLedger),
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
