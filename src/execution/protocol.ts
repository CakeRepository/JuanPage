import {
  MeaningMutationOpcode,
  validateMeaningDelta,
  type ActionArguments,
  type ActionMutation,
  type MeaningDelta,
  type MeaningMutation,
} from "../protocol/meaning.js";
import type { PageScalar } from "../schema/page.js";

export type ActionDecision = "approved" | "rejected" | "cancelled";

export type ActionFactChange = Readonly<
  | { kind: "set"; target: string; property: string; value: PageScalar }
  | { kind: "remove"; target: string; property: string }
>;

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

function assertId(value: string, name: string): void {
  if (!idPattern.test(value)) throw new Error(`${name} must be an opaque M1 symbol id.`);
}

function actionMutation(deltaInput: unknown, opcode?: number): ActionMutation {
  const delta = validateMeaningDelta(deltaInput);
  const mutation = delta[4].find((candidate): candidate is ActionMutation => {
    const candidateOpcode = Number(candidate[0]);
    return candidateOpcode >= MeaningMutationOpcode.InvokeAction
      && candidateOpcode <= MeaningMutationOpcode.CancelAction
      && (opcode === undefined || candidateOpcode === opcode);
  });
  if (!mutation) throw new Error("The M1 delta does not contain the required action mutation.");
  return mutation;
}

export function createActionDecisionDelta(
  proposalDeltaInput: unknown,
  baseRevision: number,
  actorId: string,
  decision: ActionDecision,
  argumentsOverride: ActionArguments = {},
  timestamp = new Date().toISOString(),
): MeaningDelta {
  const proposal = validateMeaningDelta(proposalDeltaInput);
  const mutation = actionMutation(proposal, MeaningMutationOpcode.ProposeAction);
  if (!Number.isInteger(baseRevision) || baseRevision < proposal[3]) {
    throw new Error("An action decision must continue from the proposal revision or a later replayed revision.");
  }
  assertId(actorId, "actorId");
  if (Number.isNaN(Date.parse(timestamp))) throw new Error("Action decision timestamp must be an ISO timestamp.");

  const opcode = decision === "approved"
    ? MeaningMutationOpcode.ApproveAction
    : decision === "rejected"
      ? MeaningMutationOpcode.RejectAction
      : MeaningMutationOpcode.CancelAction;
  const args: ActionArguments = { ...mutation[5], ...argumentsOverride, decision };
  return validateMeaningDelta([
    1,
    proposal[1],
    baseRevision,
    baseRevision + 1,
    [[opcode, mutation[1], actorId, mutation[3], mutation[4], args, mutation[6], timestamp]],
  ]);
}

export function createActionResultDelta(input: Readonly<{
  packetId: string;
  baseRevision: number;
  mutationId: string;
  actionId: string;
  succeeded: boolean;
  result?: ActionArguments;
  facts?: readonly ActionFactChange[];
  timestamp?: string;
}>): MeaningDelta {
  assertId(input.packetId, "packetId");
  assertId(input.mutationId, "mutationId");
  assertId(input.actionId, "actionId");
  if (!Number.isInteger(input.baseRevision) || input.baseRevision < 0) {
    throw new Error("baseRevision must be a non-negative integer.");
  }
  const timestamp = input.timestamp ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(timestamp))) throw new Error("Action result timestamp must be an ISO timestamp.");

  const mutations: MeaningMutation[] = [[
    input.succeeded ? MeaningMutationOpcode.ActionResult : MeaningMutationOpcode.ActionFailed,
    input.mutationId,
    input.actionId,
    input.result ?? {},
    timestamp,
  ]];
  for (const fact of input.facts ?? []) {
    assertId(fact.target, "fact.target");
    assertId(fact.property, "fact.property");
    mutations.push(fact.kind === "set"
      ? [MeaningMutationOpcode.SetFact, fact.target, fact.property, fact.value]
      : [MeaningMutationOpcode.RemoveFact, fact.target, fact.property]);
  }

  return validateMeaningDelta([
    1,
    input.packetId,
    input.baseRevision,
    input.baseRevision + 1,
    mutations,
  ]);
}

export function actionMutationFromDelta(deltaInput: unknown): ActionMutation {
  return actionMutation(deltaInput);
}
