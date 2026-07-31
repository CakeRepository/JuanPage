import { describe, expect, it } from "vitest";
import trustFixture from "../spec/fixtures/trust.json";
import { decodePage, encodeMeaningPacket } from "../src/encoding/pagePipeline";
import { futureMeaningPacket } from "../src/examples/meaning-workspace";
import {
  applyMeaningDelta,
  createActionDelta,
  createActionReceipt,
  createFactDelta,
  createScopeDelta,
  createSelectionDelta,
  interactionStateFromMeaningDeltas,
  materializeMeaningPacket,
  MeaningMutationOpcode,
  MeaningProtocolError,
  validateActionReceipt,
  type MeaningPacket,
} from "../src/protocol/meaning";

describe("M1 meaning protocol", () => {
  it("projects symbols into JuanPage 2 semantic affordances", () => {
    const page = materializeMeaningPacket(futureMeaningPacket);
    expect(page.version).toBe("2.0");
    expect(page.title).toBe("Meaning is the Interface");
    expect(page.metadata?.["m1.packetId"]).toBe("pkt:juan:future");
    expect(page.objects.some((object) => object.id === "e:decision")).toBe(true);
    expect(page.objects.some((object) => object.type === "signal")).toBe(true);
    expect(page.affordances?.length).toBeGreaterThan(0);
    expect(page.bindings?.length).toBeGreaterThan(0);
  });

  it("uses the v5 payload transport", async () => {
    const payload = await encodeMeaningPacket(futureMeaningPacket);
    const page = await decodePage(payload, "gz");
    expect(page.version).toBe("2.0");
    expect(page.metadata?.["m1.revision"]).toBe(4);
  });

  it("does not let the packet choose a component lens", () => {
    const page = materializeMeaningPacket(futureMeaningPacket);
    expect("view" in page).toBe(false);
  });

  it("applies a typed fact delta without language parsing", () => {
    const delta = createFactDelta("pkt:juan:future", 4, "e:decision", "prop:approved", true);
    const next = applyMeaningDelta(futureMeaningPacket, delta);
    const page = materializeMeaningPacket(next);
    const decision = page.objects.find((object) => object.id === "e:decision");
    expect(next[2]).toBe(5);
    expect(decision?.fields?.find((field) => field.key === "prop:approved")?.value).toBe(true);
  });

  it("enforces approval and denial before compiling affordances", () => {
    const page = materializeMeaningPacket(trustFixture as unknown as MeaningPacket);
    const deploy = page.affordances?.find((affordance) => affordance.id === "a:deploy");
    expect(deploy?.effect).toMatchObject({ kind: "invoke", policy: "approval" });
    expect(page.bindings?.some((binding) => binding.affordance === "a:deploy")).toBe(true);
    expect(page.affordances?.some((affordance) => affordance.id === "a:delete")).toBe(false);
    expect(page.metadata?.["m1.policy.a:deploy"]).toBe("approval");
    expect(page.metadata?.["m1.policy.a:delete"]).toBe("deny");
  });

  it("creates scope and selection deltas as distinct human meaning", () => {
    const scope = createScopeDelta("pkt:test", 0, "period", "2026-07");
    const selection = createSelectionDelta("pkt:test", 1, "tasks", ["task:a", "task:b"]);
    expect(scope[4][0][0]).toBe(MeaningMutationOpcode.SetScope);
    expect(selection[4][0][0]).toBe(MeaningMutationOpcode.SetSelection);
    expect(interactionStateFromMeaningDeltas([scope, selection])).toEqual({
      scopes: { period: "2026-07" },
      selections: { tasks: ["task:a", "task:b"] },
    });
  });

  it("creates replay-safe operation proposals and receipts", () => {
    const delta = createActionDelta(
      "pkt:conformance:trust",
      1,
      "actor:test",
      "a:deploy",
      "e:release",
      { source: "test", "scope.period": "2026-07" },
      "approval",
      { timestamp: "2026-07-31T21:00:00.000Z" },
    );
    expect(delta[4][0][0]).toBe(MeaningMutationOpcode.ProposeAction);
    const receipt = createActionReceipt(delta, "proposed", { queued: true }, ["ev:test"]);
    expect(validateActionReceipt(receipt)[7]).toContain("idem:");
    expect(applyMeaningDelta(trustFixture as unknown as MeaningPacket, delta)[2]).toBe(2);
  });

  it("rejects denied operation invocations", () => {
    expect(() => createActionDelta("pkt:test", 0, "actor:test", "a:delete", null, {}, "deny")).toThrow(MeaningProtocolError);
  });

  it("rejects unresolved vocabulary", () => {
    const packet = JSON.parse(JSON.stringify(futureMeaningPacket)) as unknown[];
    packet[4] = (packet[4] as unknown[]).filter((entry) => (entry as unknown[])[0] !== "txt:title");
    expect(() => materializeMeaningPacket(packet)).toThrow(MeaningProtocolError);
  });
});
