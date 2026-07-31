import type { ActionReceipt, MeaningDelta, MeaningPacket, RendererCapabilities } from "../protocol/meaning.js";
import { createActionDelta, createActionReceipt, materializeMeaningPacket } from "../protocol/meaning.js";

export type AGUIEvent = Readonly<{
  type: "RUN_STARTED" | "STATE_SNAPSHOT" | "TOOL_CALL_START" | "TOOL_CALL_ARGS" | "TOOL_CALL_END" | "RUN_FINISHED";
  threadId: string;
  runId: string;
  messageId?: string;
  toolCallId?: string;
  toolCallName?: string;
  delta?: string;
  snapshot?: unknown;
  result?: unknown;
}>;

export type AGUIBridgeResult = Readonly<{
  page: ReturnType<typeof materializeMeaningPacket>;
  delta: MeaningDelta;
  events: readonly AGUIEvent[];
  receipt: ActionReceipt;
}>;

export function bridgeMeaningActionToAGUI(input: Readonly<{
  packet: MeaningPacket;
  capabilities?: RendererCapabilities;
  actorId: string;
  actionId: string;
  targetId: string | null;
  arguments?: Readonly<Record<string, string | number | boolean | null>>;
  policy: "allow" | "approval";
  timestamp: string;
}>): AGUIBridgeResult {
  const page = materializeMeaningPacket(input.packet, input.capabilities);
  const delta = createActionDelta(
    input.packet[1],
    input.packet[2],
    input.actorId,
    input.actionId,
    input.targetId,
    input.arguments ?? {},
    input.policy,
    { timestamp: input.timestamp },
  );
  const mutation = delta[4][0];
  const mutationId = String(mutation?.[1] ?? `mutation:${input.actionId}`);
  const runId = `run:${mutationId}`;
  const threadId = input.packet[1];
  const events: AGUIEvent[] = [
    { type: "RUN_STARTED", threadId, runId },
    { type: "STATE_SNAPSHOT", threadId, runId, messageId: `snapshot:${threadId}:${input.packet[2]}`, snapshot: page },
    { type: "TOOL_CALL_START", threadId, runId, toolCallId: mutationId, toolCallName: input.actionId },
    { type: "TOOL_CALL_ARGS", threadId, runId, toolCallId: mutationId, delta: JSON.stringify(input.arguments ?? {}) },
    { type: "TOOL_CALL_END", threadId, runId, toolCallId: mutationId },
  ];
  const receipt = createActionReceipt(delta, input.policy === "approval" ? "proposed" : "authorized");
  events.push({ type: "RUN_FINISHED", threadId, runId, result: receipt });
  return { page, delta, events, receipt };
}
