import { describe, expect, it } from "vitest";
import { futureMeaningPacket } from "../src/examples/meaning-workspace.js";
import { materializeUntrustedMeaningPacket } from "../src/protocol/trust-projection.js";

describe("untrusted M1 projection", () => {
  it("preserves information and local interaction while removing authority", () => {
    const page = materializeUntrustedMeaningPacket(futureMeaningPacket);
    expect(page.objects.length).toBeGreaterThan(0);
    expect(page.affordances?.every((affordance) =>
      affordance.effect.kind !== "invoke" && affordance.effect.kind !== "navigate",
    )).toBe(true);
    const allowed = new Set((page.affordances ?? []).map((affordance) => affordance.id));
    expect(page.bindings?.every((binding) => allowed.has(binding.affordance))).toBe(true);
    expect(page.metadata?.["m1.trust"]).toBe("untrusted");
    expect(page.metadata?.["m1.execution"]).toBe("disabled");
  });
});
