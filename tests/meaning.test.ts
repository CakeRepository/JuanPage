import { describe, expect, it } from "vitest";
import trustFixture from "../spec/fixtures/trust.json";
import { decodePage, encodeMeaningPacket } from "../src/encoding/pagePipeline";
import { futureMeaningPacket } from "../src/examples/meaning-workspace";
import {
  applyMeaningDelta,
  createActionDelta,
  createActionReceipt,
  createFactDelta,
  LensCapability,
  materializeMeaningPacket,
  MeaningMutationOpcode,
  MeaningProtocolError,
  validateActionReceipt,
  type MeaningPacket,
  type RendererCapabilities,
} from "../src/protocol/meaning";

describe("M1 meaning protocol", () => {
  it("projects symbols into the existing JuanPage runtime", () => {
    const page = materializeMeaningPacket(futureMeaningPacket);
    expect(page.title).toBe("Meaning is the Interface");
    expect(page.metadata?.["m1.packetId"]).toBe("pkt:juan:future");
    expect(page.objects.some((object) => object.id === "e:decision")).toBe(true);
    expect(page.objects.some((object) => object.type === "signal")).toBe(true);
  });

  it("uses the same v3 payload transport", async () => {
    const payload = await encodeMeaningPacket(futureMeaningPacket);
    const page = await decodePage(payload, "gz");
    expect(page.metadata?.["m1.revision"]).toBe(4);
  });

  it("negotiates a supported lens", () => {
    const tableOnly: RendererCapabilities = [1, "en-US", 3, LensCapability.Table, ["*"], 1440, 900, 0];
    expect(materializeMeaningPacket(futureMeaningPacket, tableOnly).view?.defaultLens).toBe("table");
  });

  it("applies a typed fact delta without language parsing", () => {
    const delta = createFactDelta("pkt:juan:future", 4, "e:decision", "prop:approved", true);
    const next = applyMeaningDelta(futureMeaningPacket, delta);
    const page = materializeMeaningPacket(next);
    const decision = page.objects.find((object) => object.id === "e:decision");
    expect(next[2]).toBe(5);
    expect(decision?.fields?.find((field) => field.key === "prop:approved")?.value).toBe(true);
  });

  it("enforces approval and denial before rendering actions", () => {
    const page = materializeMeaningPacket(trustFixture as MeaningPacket);
    const release = page.objects.find((object) => object.id === "e:release");
    expect(release?.actionIds).toEqual(["a:deploy"]);
    expect(page.actions?.find((action) => action.id === "a:deploy")?.kind).toBe("emit");
    expect(page.actions?.some((action) => action.id === "a:delete")).toBe(false);
    expect(page.metadata?.["m1.policy.a:deploy"]).toBe("approval");
    expect(page.metadata?.["m1.policy.a:delete"]).toBe("deny");
  });

  it("creates replay-safe action proposals and receipts", () => {
    const delta = createActionDelta(
      "pkt:conformance:trust",
      1,
      "actor:test",
      "a:deploy",
      "e:release",
      { source: "test" },
      "approval",
      { timestamp: "2026-07-31T21:00:00.000Z" },
    );
    expect(delta[4][0][0]).toBe(MeaningMutationOpcode.ProposeAction);
    const receipt = createActionReceipt(delta, "proposed", { queued: true }, ["ev:test"]);
    expect(validateActionReceipt(receipt)[7]).toContain("idem:");
    expect(applyMeaningDelta(trustFixture as MeaningPacket, delta)[2]).toBe(2);
  });

  it("rejects denied action invocations", () => {
    expect(() => createActionDelta("pkt:test", 0, "actor:test", "a:delete", null, {}, "deny")).toThrow(MeaningProtocolError);
  });

  it("rejects unresolved vocabulary", () => {
    const packet = JSON.parse(JSON.stringify(futureMeaningPacket)) as unknown[];
    packet[4] = (packet[4] as unknown[]).filter((entry) => (entry as unknown[])[0] !== "txt:title");
    expect(() => materializeMeaningPacket(packet)).toThrow(MeaningProtocolError);
  });
});
