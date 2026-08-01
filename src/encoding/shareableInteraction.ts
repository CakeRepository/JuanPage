import {
  buildPageShareUrl,
  type MeaningSession,
  type PagePayloadEncoding,
} from "./pagePipeline.js";
import {
  pageBindingTargetSchema,
  validatePage,
  type JuanPageDocument,
  type PageBindingTarget,
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

export const VIEW_QUERY_METADATA_KEY = "juanpager.view.query";
export const VIEW_GROUP_METADATA_KEY = "juanpager.view.group";
export const VIEW_INSPECTION_METADATA_KEY = "juanpager.view.inspection";

export type SharedViewState = Readonly<{
  query?: string;
  group?: string;
  inspection?: PageBindingTarget;
}>;

function optionalText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().slice(0, max);
  return normalized || undefined;
}

function inspectionFromText(value: unknown): PageBindingTarget | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const parsed = pageBindingTargetSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function interactionLedgerFromMeaningSession(session: MeaningSession): SharedInteractionEntry[] {
  return interactionLedgerFromMeaningDeltas(session.deltas);
}

export function sharedViewStateFromPage(page: JuanPageDocument): SharedViewState {
  return {
    query: optionalText(page.metadata?.[VIEW_QUERY_METADATA_KEY], 500),
    group: optionalText(page.metadata?.[VIEW_GROUP_METADATA_KEY], 120),
    inspection: inspectionFromText(page.metadata?.[VIEW_INSPECTION_METADATA_KEY]),
  };
}

export function sharedViewStateFromRuntime(page: JuanPageDocument, state: PageState): SharedViewState {
  const encoded = sharedViewStateFromPage(page);
  const query = optionalText(state.queries.objects, 500) ?? encoded.query;
  const group = optionalText(state.filters.group, 120) ?? encoded.group;
  const inspection = inspectionFromText(state.panels.inspector) ?? encoded.inspection;
  return { query, group, inspection };
}

function metadataWithViewState(
  page: JuanPageDocument,
  view: SharedViewState,
): Record<string, string | number | boolean | null> {
  const metadata: Record<string, string | number | boolean | null> = { ...(page.metadata ?? {}) };
  const query = optionalText(view.query, 500);
  const group = optionalText(view.group, 120);
  if (query) metadata[VIEW_QUERY_METADATA_KEY] = query;
  else delete metadata[VIEW_QUERY_METADATA_KEY];
  if (group) metadata[VIEW_GROUP_METADATA_KEY] = group;
  else delete metadata[VIEW_GROUP_METADATA_KEY];
  if (view.inspection) metadata[VIEW_INSPECTION_METADATA_KEY] = JSON.stringify(view.inspection);
  else delete metadata[VIEW_INSPECTION_METADATA_KEY];
  return metadata;
}

export function pageWithSharedInteractionState(
  page: JuanPageDocument,
  state: PageState,
  activity: readonly SharedInteractionEntry[] = [],
  view: SharedViewState = sharedViewStateFromRuntime(page, state),
): JuanPageDocument {
  const ledger = sharedInteractionLedger(page, state, activity);
  const encoded = encodeInteractionLedger(ledger);
  const persistedLedger = JSON.parse(encoded) as SharedInteractionEntry[];
  const metadata = metadataWithViewState(page, view);
  metadata[INTERACTION_LEDGER_METADATA_KEY] = encoded;
  metadata[INTERACTION_COUNT_METADATA_KEY] = persistedLedger.length;
  metadata[INTERACTION_SHARE_MODE_METADATA_KEY] = "state-ledger-and-view";
  return validatePage({
    ...page,
    objects: withInteractionLedgerObject(effectivePageObjects(page, state), persistedLedger),
    state: pageInteractionSnapshot(state),
    metadata,
  });
}

export async function buildInteractivePageShareUrl(
  page: JuanPageDocument,
  state: PageState,
  baseUrl: string,
  encoding: PagePayloadEncoding = "gz",
  activity: readonly SharedInteractionEntry[] = [],
  view: SharedViewState = sharedViewStateFromRuntime(page, state),
): Promise<string> {
  return buildPageShareUrl(pageWithSharedInteractionState(page, state, activity, view), baseUrl, encoding);
}
