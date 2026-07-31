import { describe, expect, it } from "vitest";
import { decodePage, encodeMeaningPacket } from "../src/encoding/pagePipeline";
import { futureMeaningPacket } from "../src/examples/meaning-workspace";
import {
  applyMeaningDelta,
  createFactDelta,
  LensCapability,
  materializeMeaningPacket,
  MeaningProtocolError,
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

  it("rejects unresolved vocabulary", () => {
    const packet = JSON.parse(JSON.stringify(futureMeaningPacket)) as unknown[];
    packet[4] = (packet[4] as unknown[]).filter((entry) => (entry as unknown[])[0] !== "txt:title");
    expect(() => materializeMeaningPacket(packet)).toThrow(MeaningProtocolError);
  });
});
