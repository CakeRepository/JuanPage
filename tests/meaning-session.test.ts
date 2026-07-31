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
  createScopeDelta,
} from "../src/protocol/meaning";

describe("M1 URL sessions", () => {
  it("round-trips edits, scopes, and receipts through one URL payload", async () => {
    let session = createMeaningSession(operationsControlRoomPacket);
    const fact = createFactDelta("pkt:demo:operations", 20, "e:release", "prop:ring", "broad");
    session = appendMeaningSessionDelta(session, fact);

    const scope = createScopeDelta("pkt:demo:operations", 21, "prop:period", "2026-06");
    session = appendMeaningSessionDelta(session, scope);

    const proposal = createActionDelta(
      "pkt:demo:operations",
      22,
      "actor:human:test",
      "a:approve",
      "e:release",
      { source: "url-session", "scope.prop:period": "2026-06" },
      "approval",
      { timestamp: "2026-07-31T21:45:00.000Z" },
    );
    const receipt = createActionReceipt(proposal, "proposed", { execution: "record-only" });
    session = appendMeaningSessionDelta(session, proposal, receipt);

    const payload = await encodeMeaningSession(session);
    const decoded = await decodePagePayload(payload, "gz");

    expect(decoded.kind).toBe("m1-session");
    if (decoded.kind !== "m1-session") throw new Error("expected an M1 session");
    expect(decoded.session.deltas).toHaveLength(3);
    expect(decoded.session.receipts).toHaveLength(1);
    expect(decoded.currentPacket[2]).toBe(23);
    expect(decoded.page.metadata?.["m1.execution"]).toBe("record-only");
    expect(decoded.page.affordances?.some((affordance) => affordance.id === "a:approve")).toBe(true);
    expect(decoded.page.affordances?.some((affordance) => affordance.effect.kind === "navigate")).toBe(false);
    expect(decoded.page.state?.scopes?.["prop:period"]).toBe("2026-06");

    const release = decoded.page.objects.find((object) => object.id === "e:release");
    expect(release?.fields?.find((field) => field.key === "prop:ring")?.value).toBe("broad");
    expect(replayMeaningSession(decoded.session)[2]).toBe(23);
  });

  it("rejects a broken revision chain", () => {
    const session = createMeaningSession(operationsControlRoomPacket);
    const wrongBase = createFactDelta("pkt:demo:operations", 99, "e:release", "prop:ring", "production");
    expect(() => appendMeaningSessionDelta(session, wrongBase)).toThrow();
  });
});
