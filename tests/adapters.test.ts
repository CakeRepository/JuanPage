import { describe, expect, it } from "vitest";
import { toA2UIBridge, toAGUIBridgeEvents, toMcpAppResource } from "../src/adapters";
import { futureMeaningPacket } from "../src/examples/meaning-workspace";
import { materializeMeaningPacket } from "../src/protocol/meaning";

describe("interoperability bridges", () => {
  const page = materializeMeaningPacket(futureMeaningPacket);

  it("creates an A2UI bridge model from the canonical page", () => {
    const bridge = toA2UIBridge(page);
    expect(bridge.protocol).toBe("a2ui-bridge");
    expect(bridge.components.length).toBe(page.objects.length);
  });

  it("creates an AG-UI state snapshot", () => {
    const events = toAGUIBridgeEvents(page);
    expect(events[0].type).toBe("STATE_SNAPSHOT");
    expect(events[0].messageId).toContain("pkt:juan:future");
  });

  it("creates an MCP App resource", () => {
    const resource = toMcpAppResource(page);
    expect(resource.uri).toBe("ui://juanpager/current");
    expect(JSON.parse(resource.text).title).toBe(page.title);
  });
});
