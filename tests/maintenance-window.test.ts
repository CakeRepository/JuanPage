import { describe, expect, it } from "vitest";
import { maintenanceWindowPacket } from "../src/examples/maintenance-window";
import { materializeMeaningPacket } from "../src/protocol/meaning";
import { validatePage } from "../src/schema/page";

describe("maintenance window example", () => {
  it("materializes a valid JuanPage 2.0 document from M1", () => {
    const page = materializeMeaningPacket(maintenanceWindowPacket);

    expect(validatePage(page)).toBe(page);
    expect(page.version).toBe("2.0");
    expect(page.title).toBe("Endpoint Maintenance Window");
    expect(page.metadata?.["m1.packetId"]).toBe("pkt:demo:maintenance-window");
    expect(page.objects.filter((object) => object.type === "Endpoint")).toHaveLength(3);
  });

  it("uses typed scope and selection state for local human decisions", () => {
    const page = materializeMeaningPacket(maintenanceWindowPacket);

    expect(page.scopes?.find((scope) => scope.id === "prop:site")).toMatchObject({
      field: "prop:site",
      initial: null,
    });
    expect(page.affordances?.find((affordance) => affordance.id === "a:site")).toMatchObject({
      effect: { kind: "scope", scope: "prop:site" },
      input: { kind: "choice" },
    });
    expect(page.affordances?.find((affordance) => affordance.id === "a:holdback")?.effect).toEqual({
      kind: "select",
      selection: "selection:holdbacks",
      mode: "multiple",
    });
    expect(page.bindings?.filter((binding) => binding.affordance === "a:holdback")).toHaveLength(3);
  });

  it("binds every visible control to a real semantic effect", () => {
    const page = materializeMeaningPacket(maintenanceWindowPacket);
    const boundAffordances = new Set(page.bindings?.map((binding) => binding.affordance));

    expect(boundAffordances).toEqual(new Set(["a:site", "a:holdback", "a:inspect", "a:note", "a:approve"]));
    expect(page.affordances?.find((affordance) => affordance.id === "a:note")).toMatchObject({
      effect: { kind: "set", field: "prop:note" },
      input: { kind: "text", multiline: true },
    });
  });

  it("compiles rollout approval as an approval-gated invocation", () => {
    const page = materializeMeaningPacket(maintenanceWindowPacket);

    expect(page.affordances?.find((affordance) => affordance.id === "a:approve")).toMatchObject({
      effect: {
        kind: "invoke",
        operation: "op:maintenance.approve",
        policy: "approval",
      },
      input: { kind: "none" },
    });
    expect(page.metadata?.["m1.policy.a:approve"]).toBe("approval");
    expect(page.metadata?.["m1.operation.a:approve"]).toBe("op:maintenance.approve");
  });
});
