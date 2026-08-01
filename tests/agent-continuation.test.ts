import { describe, expect, it, vi } from "vitest";
import {
  appendMeaningSessionDelta,
  createMeaningSession,
  replayMeaningSession,
} from "../src/encoding/pagePipeline";
import { operationsControlRoomPacket } from "../src/examples/operations-control-room";
import {
  executeStoredAgentHumanSession,
  type AgentHumanActionExecutor,
} from "../src/execution/executor";
import {
  createActionDecisionDelta,
} from "../src/execution/protocol";
import {
  ReceiptStateCode,
  createActionDelta,
  createActionReceipt,
  materializeMeaningPacket,
} from "../src/protocol/meaning";
import {
  advanceAgentHumanSession,
  createAgentHumanSession,
} from "../src/session/session";
import { MemoryAgentHumanSessionStore } from "../src/session/store";

function completedProposalSession() {
  let meaning = createMeaningSession(operationsControlRoomPacket);
  const proposal = createActionDelta(
    operationsControlRoomPacket[1],
    operationsControlRoomPacket[2],
    "actor:human:test",
    "a:approve",
    "e:release",
    { source: "test" },
    "approval",
    {
      mutationId: "mutation:deployment:approve",
      idempotencyKey: "idempotency:deployment:approve",
      timestamp: "2026-07-31T22:00:00.000Z",
    },
  );
  meaning = appendMeaningSessionDelta(
    meaning,
    proposal,
    createActionReceipt(proposal, "proposed", { execution: "record-only" }),
  );
  const created = createAgentHumanSession({
    id: "session:verified-agent-loop",
    document: materializeMeaningPacket(operationsControlRoomPacket),
    meaning,
    now: "2026-07-31T22:00:00.000Z",
    source: { kind: "agent", agentId: "agent:test", requestId: "request:test" },
  });
  return advanceAgentHumanSession(created, {
    status: "completed",
    meaning,
    now: "2026-07-31T22:01:00.000Z",
  }, created.revision);
}

describe("verified agent continuation", () => {
  it("turns completed human intent into one idempotent verified execution", async () => {
    const store = new MemoryAgentHumanSessionStore();
    const session = completedProposalSession();
    await store.put(session);

    const execute = vi.fn<AgentHumanActionExecutor["execute"]>().mockResolvedValue({
      status: "succeeded",
      result: { deploymentId: "deployment:42", approved: true },
      facts: [{ kind: "set", target: "e:release", property: "prop:approved", value: true }],
      evidence: ["evidence:deployment:42"],
    });
    const executor: AgentHumanActionExecutor = { name: "deployment-control", execute };

    const result = await executeStoredAgentHumanSession({
      sessionId: session.id,
      store,
      executor,
      now: "2026-07-31T22:02:00.000Z",
    });

    expect(result.status).toBe("executed");
    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.request?.idempotencyKey).toBe("idempotency:deployment:approve");
    expect(result.request?.actionId).toBe("a:approve");
    expect(result.session.metadata?.["execution.status"]).toBe("succeeded");
    expect(result.session.document.metadata?.["m1.execution"]).toBe("verified-host");
    expect(result.session.document.objects
      .find((object) => object.id === "e:release")
      ?.fields?.find((field) => field.key === "prop:approved")?.value).toBe(true);
    expect(result.session.meaning?.receipts.map((receipt) => receipt[5])).toEqual([
      ReceiptStateCode.Proposed,
      ReceiptStateCode.Authorized,
      ReceiptStateCode.Executing,
      ReceiptStateCode.Succeeded,
    ]);
    expect(result.session.meaning && replayMeaningSession(result.session.meaning)[2]).toBe(23);

    const repeated = await executeStoredAgentHumanSession({
      sessionId: session.id,
      store,
      executor,
      now: "2026-07-31T22:03:00.000Z",
    });
    expect(repeated.status).toBe("already-completed");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("requires explicit completion before executing a proposal", async () => {
    const completed = completedProposalSession();
    const open = { ...completed, status: "open" as const };
    const executor: AgentHumanActionExecutor = {
      name: "never",
      execute: vi.fn().mockResolvedValue({ status: "succeeded" }),
    };
    const store = new MemoryAgentHumanSessionStore();
    await store.put(open);

    const result = await executeStoredAgentHumanSession({ sessionId: open.id, store, executor });
    expect(result.status).toBe("awaiting-human");
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it("creates linked approval and rejection mutations from one proposal", () => {
    const proposal = createActionDelta(
      "packet:test",
      4,
      "actor:human:test",
      "action:test",
      "entity:test",
      {},
      "approval",
      { mutationId: "mutation:test", idempotencyKey: "idempotency:test" },
    );
    const approved = createActionDecisionDelta(proposal, 5, "actor:reviewer", "approved");
    const rejected = createActionDecisionDelta(proposal, 5, "actor:reviewer", "rejected");

    expect(approved[4][0]?.[0]).toBe(32);
    expect(rejected[4][0]?.[0]).toBe(33);
    expect(approved[4][0]?.[1]).toBe("mutation:test");
    expect(approved[4][0]?.[6]).toBe("idempotency:test");
  });
});
