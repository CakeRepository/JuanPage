import { describe, expect, it } from "vitest";
import { futureMeaningPacket } from "../src/examples/meaning-workspace.js";
import { materializeUntrustedMeaningPacket } from "../src/protocol/trust-projection.js";

describe("untrusted M1 projection", () => {
  it("preserves information while removing every executable action", () => {
    const page = materializeUntrustedMeaningPacket(futureMeaningPacket);
    expect(page.objects.length).toBeGreaterThan(0);
    expect(page.actions).toEqual([]);
    expect(page.objects.every((object) => (object.actionIds ?? []).length === 0)).toBe(true);
    expect(page.metadata?.["m1.trust"]).toBe("untrusted");
    expect(page.metadata?.["m1.execution"]).toBe("disabled");
  });
});
