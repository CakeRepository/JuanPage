import { z } from "zod";
import {
  createActionDelta,
  interactionStateFromMeaningDeltas,
  validateMeaningDelta,
  type ActionArguments,
  type ActionMutation,
  type MeaningDelta,
  type MeaningMutation,
} from "./meaning.js";
import {
  pageInteractionDomainSchema,
  pageInteractionStateSchema,
  pageInteractionValueSchema,
  type PageInteractionDomain,
  type PageInteractionState,
  type PageInteractionValue,
} from "../schema/interaction.js";
import type { PageScalar } from "../schema/page.js";
import type { PageStatePatch } from "../state/pageState.js";

export const INTERACTION_STATE_ACTION = "op:interaction.state";
export const TRANSACTION_ACTION = "op:interaction.transaction";
export const INTERACTION_SCHEMA = "juanpage-interaction-v1";
export const TRANSACTION_SCHEMA = "juanpage-transaction-v1";

const transactionActionSchema = z.enum(["commit", "cancel", "undo", "redo"]);
type TransactionAction = z.infer<typeof transactionActionSchema>;
type EncodedStateAction = Readonly<{ domain: PageInteractionDomain; key: string; value?: PageInteractionValue }>;

function parseJson(value: PageScalar | undefined, label: string): unknown {
  if (typeof value !== "string") throw new Error(`${label} must be encoded as JSON text`);
  try { return JSON.parse(value) as unknown; }
  catch (error) { throw new Error(`${label} contains invalid JSON`, { cause: error }); }
}

function actionMutations(delta: MeaningDelta): ActionMutation[] {
  return delta[4].filter((mutation): mutation is ActionMutation => mutation[0] >= 30 && mutation[0] <= 34);
}

function interactionAction(
  packetId: string,
  revision: number,
  actorId: string,
  domain: PageInteractionDomain,
  key: string,
  value: PageInteractionValue | undefined,
  index = 0,
): ActionMutation {
  const args: ActionArguments = {
    schema: INTERACTION_SCHEMA,
    domain,
    key,
    value: value === undefined ? null : JSON.stringify(value),
  };
  return createActionDelta(
    packetId,
    revision,
    actorId,
    INTERACTION_STATE_ACTION,
    null,
    args,
    "allow",
    {
      mutationId: `mut:state:${revision + 1}:${index}`,
      idempotencyKey: `idem:${packetId}:${revision + 1}:state:${index}`,
    },
  )[4][0] as ActionMutation;
}

function patchMutation(
  packetId: string,
  revision: number,
  actorId: string,
  patch: PageStatePatch,
  side: "before" | "after",
  index: number,
): MeaningMutation {
  const value = patch[side];
  if (patch.domain === "value") return value === undefined ? [21, patch.target, patch.field] : [20, patch.target, patch.field, value];
  if (patch.domain === "scope") return value === undefined || value === null ? [23, patch.key] : [22, patch.key, value];
  if (patch.domain === "selection") return [24, patch.key, value === undefined ? [] : [...value]];
  return interactionAction(packetId, revision, actorId, patch.state, patch.key, value, index);
}

export function createInteractionStateDelta(
  packetId: string,
  baseRevision: number,
  domain: PageInteractionDomain,
  key: string,
  value: PageInteractionValue | undefined,
  actorId = "actor:human:browser",
): MeaningDelta {
  pageInteractionDomainSchema.parse(domain);
  if (value !== undefined) pageInteractionValueSchema.parse(value);
  return validateMeaningDelta([1, packetId, baseRevision, baseRevision + 1, [interactionAction(packetId, baseRevision, actorId, domain, key, value)]]);
}

export function createPageTransactionDelta(
  packetId: string,
  baseRevision: number,
  transactionId: string,
  action: TransactionAction,
  patches: readonly PageStatePatch[],
  actorId = "actor:human:browser",
): MeaningDelta {
  transactionActionSchema.parse(action);
  const marker = createActionDelta(
    packetId,
    baseRevision,
    actorId,
    TRANSACTION_ACTION,
    null,
    { schema: TRANSACTION_SCHEMA, transactionId, action, patchCount: patches.length },
    "allow",
    {
      mutationId: `mut:transaction:${baseRevision + 1}`,
      idempotencyKey: `idem:${packetId}:${baseRevision + 1}:transaction:${transactionId}`,
    },
  )[4][0] as ActionMutation;
  const side = action === "undo" ? "before" : "after";
  const mutations: MeaningMutation[] = [marker];
  if (action !== "cancel") patches.forEach((patch, index) => mutations.push(patchMutation(packetId, baseRevision, actorId, patch, side, index + 1)));
  return validateMeaningDelta([1, packetId, baseRevision, baseRevision + 1, mutations]);
}

function decodeStateAction(mutation: ActionMutation): EncodedStateAction | undefined {
  if (mutation[3] !== INTERACTION_STATE_ACTION || mutation[5].schema !== INTERACTION_SCHEMA) return undefined;
  const domain = pageInteractionDomainSchema.parse(mutation[5].domain);
  const key = typeof mutation[5].key === "string" ? mutation[5].key : "";
  if (!key) throw new Error("Interaction state mutation is missing its key");
  const encoded = mutation[5].value;
  const value = encoded === null ? undefined : pageInteractionValueSchema.parse(parseJson(encoded, "interaction state value"));
  return { domain, key, value };
}

function setStateValue(state: PageInteractionState, action: EncodedStateAction): void {
  if (action.domain === "focus") {
    state.focus = typeof action.value === "string" ? action.value : undefined;
    return;
  }
  const current = (state[action.domain] ?? {}) as Record<string, PageInteractionValue>;
  if (action.value === undefined) delete current[action.key];
  else current[action.key] = structuredClone(action.value);
  (state as unknown as Record<string, unknown>)[action.domain] = current;
}

export function interactionStateFromPageDeltas(deltas: readonly MeaningDelta[]): PageInteractionState {
  const state = pageInteractionStateSchema.parse(interactionStateFromMeaningDeltas(deltas));
  for (const delta of deltas.map(validateMeaningDelta)) {
    for (const mutation of actionMutations(delta)) {
      const action = decodeStateAction(mutation);
      if (action) setStateValue(state, action);
    }
  }
  return pageInteractionStateSchema.parse(state);
}
