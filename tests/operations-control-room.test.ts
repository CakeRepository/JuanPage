import { describe, expect, it } from "vitest";
import { operationsControlRoomPacket } from "../src/examples/operations-control-room";
import { materializeMeaningPacket } from "../src/protocol/meaning";

describe("operations control room example", () => {
  it("materializes realistic demo data through the one JuanPage runtime", () => {
    const page = materializeMeaningPacket(operationsControlRoomPacket);

    expect(page.title).toBe("Northstar Operations Control Room");
    expect(page.metadata?.["m1.packetId"]).toBe("pkt:demo:operations");
    expect(page.objects.some((object) => object.id === "e:release")).toBe(true);
    expect(page.objects.some((object) => object.id === "s:incident-overdue")).toBe(true);
    expect(page.relations).toHaveLength(4);
  });

  it("shows allowed and approval actions while removing denied actions", () => {
    const page = materializeMeaningPacket(operationsControlRoomPacket);
    const release = page.objects.find((object) => object.id === "e:release");
    const incident = page.objects.find((object) => object.id === "e:incident");

    expect(release?.actionIds).toEqual(["a:approve", "a:ring", "a:note"]);
    expect(incident?.actionIds).toEqual(["a:retry"]);
    expect(page.actions?.find((action) => action.id === "a:approve")?.kind).toBe("emit");
    expect(page.actions?.find((action) => action.id === "a:ring")?.kind).toBe("choice");
    expect(page.actions?.some((action) => action.id === "a:delete")).toBe(false);
    expect(page.metadata?.["m1.policy.a:approve"]).toBe("approval");
    expect(page.metadata?.["m1.policy.a:delete"]).toBe("deny");
  });
});
