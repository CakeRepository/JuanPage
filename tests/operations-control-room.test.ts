import { describe, expect, it } from "vitest";
import { operationsControlRoomPacket } from "../src/examples/operations-control-room";
import { materializeMeaningPacket } from "../src/protocol/meaning";

describe("operations control room example", () => {
  it("materializes realistic demo data through JuanPage 2", () => {
    const page = materializeMeaningPacket(operationsControlRoomPacket);
    expect(page.version).toBe("2.0");
    expect(page.title).toBe("Northstar Operations Control Room");
    expect(page.metadata?.["m1.packetId"]).toBe("pkt:demo:operations");
    expect(page.objects.some((object) => object.id === "e:release")).toBe(true);
    expect(page.objects.some((object) => object.id === "s:incident-overdue")).toBe(true);
    expect(page.objects.filter((object) => object.type === "Financial record")).toHaveLength(3);
    expect(page.relations).toHaveLength(4);
  });

  it("compiles a revenue projection and period scope from M1", () => {
    const page = materializeMeaningPacket(operationsControlRoomPacket);
    expect(page.projections?.find((projection) => projection.id === "projection:revenue")).toMatchObject({
      dimension: "prop:period",
      operation: "sum",
      measure: "prop:revenue",
      currency: "USD",
    });
    expect(page.scopes?.find((scope) => scope.id === "prop:period")).toMatchObject({
      field: "prop:period",
      initial: "2026-07",
    });
    expect(page.bindings?.some((binding) =>
      binding.target.kind === "projection"
      && binding.target.projection === "projection:revenue"
      && binding.affordance === "a:period",
    )).toBe(true);
  });

  it("keeps allowed and approval affordances while removing denied authority", () => {
    const page = materializeMeaningPacket(operationsControlRoomPacket);
    expect(page.affordances?.find((affordance) => affordance.id === "a:approve")?.effect).toMatchObject({
      kind: "invoke",
      policy: "approval",
    });
    expect(page.affordances?.find((affordance) => affordance.id === "a:ring")?.effect).toMatchObject({
      kind: "set",
      field: "prop:ring",
    });
    expect(page.affordances?.some((affordance) => affordance.id === "a:delete")).toBe(false);
    expect(page.bindings?.some((binding) => binding.affordance === "a:inspect-release")).toBe(true);
    expect(page.metadata?.["m1.policy.a:approve"]).toBe("approval");
    expect(page.metadata?.["m1.policy.a:delete"]).toBe("deny");
  });
});
