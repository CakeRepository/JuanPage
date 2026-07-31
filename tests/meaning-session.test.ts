import { describe, expect, it } from "vitest";
import {
  appendMeaningSessionDelta,
  createMeaningSession,
  decodePagePayload,
  encodeMeaningSession,
  replayMeaningSession,
} from "../src/encoding/pagePipeline";
import { operationsControlRoomPacket } from "../src/examples/operations-control-room";
import {
  createActionDelta,
  createActionReceipt,
  createFactDelta,
} from "../src/protocol/meaning";

describe("M1 URL sessions", () => {
  it("round-trips typed human edits and receipts through one URL payload", async () => {
    let session = createMeaningSession(operationsControlRoomPacket);
    const fact = createFactDelta("pkt:demo:operations", 12, "e:release", "prop:ring", "broad");
    session = appendMeaningSessionDelta(session, fact);

    const proposal = createActionDelta(
      "pkt:demo:operations",
      13,
      "actor:human:test",
      "a:approve",
      "e:release",
      { source: "url-session" },
      "approval",
      { timestamp: "2026-07-31T21:45:00.000Z" },
    );
    const receipt = createActionReceipt(proposal, "proposed", { execution: "record-only" });
    session = appendMeaningSessionDelta(session, proposal, receipt);

    const payload = await encodeMeaningSession(session);
    const decoded = await decodePagePayload(payload, "gz");

    expect(decoded.kind).toBe("m1-session");
    if (decoded.kind !== "m1-session") throw new Error("expected an M1 session");
    expect(decoded.session.deltas).toHaveLength(2);
    expect(decoded.session.receipts).toHaveLength(1);
    expect(decoded.currentPacket[2]).toBe(14);
    expect(decoded.page.metadata?.["m1.execution"]).toBe("record-only");
    expect(decoded.page.actions?.some((action) => action.id === "a:approve")).toBe(true);
    expect(decoded.page.actions?.some((action) => action.kind === "open")).toBe(false);

    const release = decoded.page.objects.find((object) => object.id === "e:release");
    expect(release?.fields?.find((field) => field.key === "prop:ring")?.value).toBe("broad");
    expect(replayMeaningSession(decoded.session)[2]).toBe(14);
  });

  it("rejects a broken revision chain", () => {
    const session = createMeaningSession(operationsControlRoomPacket);
    const wrongBase = createFactDelta("pkt:demo:operations", 99, "e:release", "prop:ring", "production");
    expect(() => appendMeaningSessionDelta(session, wrongBase)).toThrow();
  });
});