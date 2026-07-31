import { describe, expect, it } from "vitest";
import { futureMeaningPacket } from "../../src/examples/meaning-workspace.js";
import {
  actionPolicy,
  createActionDelta,
  materializeMeaningPacket,
  validateMeaningDelta,
  validateMeaningPacket,
} from "../../src/protocol/meaning.js";

describe("M1 conformance", () => {
  it("fails closed for denied executable actions", () => {
    const packet = structuredClone(futureMeaningPacket) as unknown as unknown[];
    const records = packet[5] as unknown[][];
    const permission = records.find((record) => record[0] === 8 && record[1] === "a:approve");
    if (!permission) throw new Error("fixture permission missing");
    permission[2] = 1;
    const page = materializeMeaningPacket(packet);
    expect(actionPolicy(packet, "a:approve")).toBe("deny");
    expect(page.actions?.some((action) => action.id === "a:approve")).toBe(false);
    expect(() => createActionDelta(String(packet[1]), Number(packet[2]), "actor:test", "a:approve", "e:decision", {}, "deny")).toThrow();
  });

  it("rejects revision conflicts, malformed records, and unknown references", () => {
    expect(() => validateMeaningDelta([1, futureMeaningPacket[1], 4, 4, []])).toThrow();
    expect(() => validateMeaningPacket([1, "pkt:test", 0, null, [], [[99]]])).toThrow();
    expect(() => validateMeaningPacket([1, "pkt:test", 0, null, [], [[0, [1, "Title"], null, null, 0, 0, 0, 0], [2, "missing", "p:x", true, null, 0, 0, null]]])).toThrow();
  });

  it("materializes deterministically across repeated runs", () => {
    const first = JSON.stringify(materializeMeaningPacket(futureMeaningPacket));
    for (let index = 0; index < 25; index += 1) expect(JSON.stringify(materializeMeaningPacket(futureMeaningPacket))).toBe(first);
  });

  it("keeps symbolic identity stable when vocabulary text changes", () => {
    const localized = structuredClone(futureMeaningPacket) as unknown as unknown[];
    localized[4] = (localized[4] as [string, string][]).map(([symbol, text]) => [symbol, `localized:${text}`]);
    const original = materializeMeaningPacket(futureMeaningPacket);
    const translated = materializeMeaningPacket(localized);
    expect(translated.objects.map((object) => object.id)).toEqual(original.objects.map((object) => object.id));
    expect(translated.actions?.map((action) => action.id)).toEqual(original.actions?.map((action) => action.id));
  });
});
