import {
  appendMeaningSessionDelta,
  replayMeaningSession,
  validateMeaningSession,
  type MeaningSession,
} from "../encoding/pagePipeline.js";
import {
  MeaningMutationOpcode,
  ReceiptStateCode,
  createActionReceipt,
  materializeMeaningPacket,
  validateActionReceipt,
  type ActionArguments,
  type ActionMutation,
  type ActionReceipt,
  type MeaningDelta,
} from "../protocol/meaning.js";
import { validatePage } from "../schema/page.js";
import {
  advanceAgentHumanSession,
  agentHumanSessionExpired,
  validateAgentHumanSession,
  type AgentHumanSession,
} from "../session/session.js";
import type { AgentHumanSessionStore } from "../session/store.js";
import {
  actionMutationFromDelta,
  createActionDecisionDelta,
  createActionResultDelta,
  type ActionFactChange,
} from "./protocol.js";

export type AgentHumanActionRequest = Readonly<{
  sessionId: string;
  packetId: string;
  packetRevision: number;
  mutationId: string;
  idempotencyKey: string;
  actionId: string;
  actorId: string;
  target: string | null;
  arguments: ActionArguments;
}>;

export type AgentHumanActionOutcome = Readonly<{
  status: "succeeded" | "failed";
  result?: ActionArguments;
  facts?: readonly ActionFactChange[];
  evidence?: readonly string[];
  error?: string;
}>;

export interface AgentHumanActionExecutor {
  readonly name: string;
  execute(request: AgentHumanActionRequest): Promise<AgentHumanActionOutcome>;
}

export type AgentHumanExecutionStatus =
  | "executed"
  | "awaiting-human"
  | "no-authorized-action"
  | "already-completed";

export type AgentHumanExecutionResult = Readonly<{
  status: AgentHumanExecutionStatus;
  session: AgentHumanSession;
  request?: AgentHumanActionRequest;
  outcome?: AgentHumanActionOutcome;
}>;

type PendingAction = Readonly<{
  kind: "authorized" | "proposal";
  delta: MeaningDelta;
  mutation: ActionMutation;
}>;

function appendMeaningSessionReceipt(sessionInput: MeaningSession, receiptInput: ActionReceipt): MeaningSession {
  const session = validateMeaningSession(sessionInput);
  const receipt = validateActionReceipt(receiptInput);
  if (receipt[2] !== session.packet[1]) {
    throw new Error("The M1 receipt packet id does not match the session packet.");
  }
  return validateMeaningSession({ ...session, receipts: [...session.receipts, receipt] });
}

function hasReceipt(session: MeaningSession, mutationId: string, state: number): boolean {
  return session.receipts.some((receipt) => receipt[4] === mutationId && receipt[5] === state);
}

function pendingAction(sessionInput: MeaningSession): PendingAction | undefined {
  const session = validateMeaningSession(sessionInput);
  const terminal = new Set<string>();
  const rejected = new Set<string>();

  for (const delta of session.deltas) {
    for (const mutation of delta[4]) {
      if (mutation[0] === MeaningMutationOpcode.ActionResult || mutation[0] === MeaningMutationOpcode.ActionFailed) {
        terminal.add(mutation[1]);
      }
      if (mutation[0] === MeaningMutationOpcode.RejectAction || mutation[0] === MeaningMutationOpcode.CancelAction) {
        rejected.add(mutation[1]);
      }
    }
  }

  for (let deltaIndex = session.deltas.length - 1; deltaIndex >= 0; deltaIndex -= 1) {
    const delta = session.deltas[deltaIndex];
    for (let mutationIndex = delta[4].length - 1; mutationIndex >= 0; mutationIndex -= 1) {
      const mutation = delta[4][mutationIndex];
      const opcode = Number(mutation[0]);
      if (opcode < MeaningMutationOpcode.InvokeAction || opcode > MeaningMutationOpcode.CancelAction) continue;
      const action = mutation as ActionMutation;
      if (terminal.has(action[1]) || rejected.has(action[1])) continue;
      if (
        (opcode === MeaningMutationOpcode.InvokeAction || opcode === MeaningMutationOpcode.ApproveAction)
        && hasReceipt(session, action[1], ReceiptStateCode.Authorized)
      ) {
        return { kind: "authorized", delta, mutation: action };
      }
      if (
        opcode === MeaningMutationOpcode.ProposeAction
        && hasReceipt(session, action[1], ReceiptStateCode.Proposed)
      ) {
        return { kind: "proposal", delta, mutation: action };
      }
    }
  }
  return undefined;
}

function hasTerminalResult(session: MeaningSession): boolean {
  return session.deltas.some((delta) => delta[4].some((mutation) =>
    mutation[0] === MeaningMutationOpcode.ActionResult || mutation[0] === MeaningMutationOpcode.ActionFailed));
}

function requestFromAction(
  session: AgentHumanSession,
  meaning: MeaningSession,
  mutation: ActionMutation,
): AgentHumanActionRequest {
  return {
    sessionId: session.id,
    packetId: meaning.packet[1],
    packetRevision: replayMeaningSession(meaning)[2],
    mutationId: mutation[1],
    actorId: mutation[2],
    actionId: mutation[3],
    target: mutation[4],
    arguments: mutation[5],
    idempotencyKey: mutation[6],
  };
}

function completedDocument(
  session: AgentHumanSession,
  meaning: MeaningSession,
  executorName: string,
  outcome: AgentHumanActionOutcome,
  mutationId: string,
  timestamp: string,
) {
  const materialized = materializeMeaningPacket(replayMeaningSession(meaning));
  return validatePage({
    ...materialized,
    state: session.document.state,
    metadata: {
      ...(session.document.metadata ?? {}),
      ...(materialized.metadata ?? {}),
      "m1.execution": "verified-host",
      "m1.executionExecutor": executorName,
      "m1.executionMutation": mutationId,
      "m1.executionStatus": outcome.status,
      "m1.executionCompletedAt": timestamp,
    },
  });
}

export async function executeAgentHumanSession(input: Readonly<{
  session: AgentHumanSession;
  executor: AgentHumanActionExecutor;
  requireCompleted?: boolean;
  authorizationActorId?: string;
  now?: string;
}>): Promise<AgentHumanExecutionResult> {
  const session = validateAgentHumanSession(input.session);
  const requireCompleted = input.requireCompleted ?? true;
  if (agentHumanSessionExpired(session)) throw new Error(`JuanPager session ${session.id} has expired.`);
  if (!session.meaning) return { status: "no-authorized-action", session };
  if (requireCompleted && session.status !== "completed") return { status: "awaiting-human", session };

  let meaning = validateMeaningSession(session.meaning);
  const pending = pendingAction(meaning);
  if (!pending) {
    return { status: hasTerminalResult(meaning) ? "already-completed" : "no-authorized-action", session };
  }

  let authorizationDelta = pending.delta;
  let authorizationMutation = pending.mutation;
  const timestamp = input.now ?? new Date().toISOString();

  if (pending.kind === "proposal") {
    authorizationDelta = createActionDecisionDelta(
      pending.delta,
      replayMeaningSession(meaning)[2],
      input.authorizationActorId ?? "actor:human:session-complete",
      "approved",
      { "session.id": session.id },
      timestamp,
    );
    authorizationMutation = actionMutationFromDelta(authorizationDelta);
    meaning = appendMeaningSessionDelta(
      meaning,
      authorizationDelta,
      createActionReceipt(authorizationDelta, "authorized", {
        execution: "human-completed-session",
        sessionId: session.id,
      }),
    );
  }

  const request = requestFromAction(session, meaning, authorizationMutation);
  meaning = appendMeaningSessionReceipt(
    meaning,
    createActionReceipt(authorizationDelta, "executing", {
      execution: "verified-host",
      executor: input.executor.name,
    }),
  );

  let outcome: AgentHumanActionOutcome;
  try {
    outcome = await input.executor.execute(request);
  } catch (error) {
    outcome = {
      status: "failed",
      error: (error instanceof Error ? error.message : String(error)).slice(0, 2000),
    };
  }

  const result = outcome.status === "failed"
    ? { ...(outcome.result ?? {}), error: (outcome.error ?? "The executor reported a failure.").slice(0, 2000) }
    : outcome.result ?? {};
  const resultDelta = createActionResultDelta({
    packetId: meaning.packet[1],
    baseRevision: replayMeaningSession(meaning)[2],
    mutationId: authorizationMutation[1],
    actionId: authorizationMutation[3],
    succeeded: outcome.status === "succeeded",
    result,
    facts: outcome.status === "succeeded" ? outcome.facts : undefined,
    timestamp,
  });
  meaning = appendMeaningSessionDelta(
    meaning,
    resultDelta,
    createActionReceipt(
      authorizationDelta,
      outcome.status,
      result,
      outcome.evidence ?? [],
    ),
  );

  const next = advanceAgentHumanSession(session, {
    document: completedDocument(session, meaning, input.executor.name, outcome, authorizationMutation[1], timestamp),
    meaning,
    status: "completed",
    metadata: {
      ...(session.metadata ?? {}),
      "execution.executor": input.executor.name,
      "execution.mutationId": authorizationMutation[1],
      "execution.status": outcome.status,
      "execution.completedAt": timestamp,
    },
    now: timestamp,
  }, session.revision);

  return { status: "executed", session: next, request, outcome };
}

export async function executeStoredAgentHumanSession(input: Readonly<{
  sessionId: string;
  store: AgentHumanSessionStore;
  executor: AgentHumanActionExecutor;
  requireCompleted?: boolean;
  authorizationActorId?: string;
  now?: string;
}>): Promise<AgentHumanExecutionResult> {
  const session = await input.store.get(input.sessionId);
  if (!session) throw new Error(`JuanPager session ${input.sessionId} was not found.`);
  const result = await executeAgentHumanSession({
    session,
    executor: input.executor,
    requireCompleted: input.requireCompleted,
    authorizationActorId: input.authorizationActorId,
    now: input.now,
  });
  if (result.status !== "executed") return result;
  const saved = await input.store.put(result.session, session.revision);
  return { ...result, session: saved };
}
