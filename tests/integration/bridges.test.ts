import { describe, expect, it } from "vitest";
import { futureMeaningPacket } from "../../src/examples/meaning-workspace.js";
import { bridgeMeaningActionToAGUI } from "../../src/adapters/agui.js";
import { openMcpAppProposal, respondToMcpApproval } from "../../src/adapters/mcp-app.js";
import { MemoryNonceStore, generateEd25519KeyPair, signMeaningPacket } from "../../src/protocol/envelope.js";

describe("protocol bridges", () => {
  it("runs M1 through JuanPage, human delta, AG-UI events, and receipt", () => {
    const result = bridgeMeaningActionToAGUI({
      packet: futureMeaningPacket,
      actorId: "actor:human:test",
      actionId: "a:deploy",
      targetId: "e:release",
      policy: "approval",
      timestamp: "2026-07-31T21:00:00.000Z",
    });
    expect(result.page.version).toBe("2.0");
    expect(result.page.affordances?.some((affordance) => affordance.id === "a:deploy")).toBe(true);
    expect(result.delta[4][0]?.[0]).toBe(31);
    expect(result.events.map((event) => event.type)).toEqual([
      "RUN_STARTED",
      "STATE_SNAPSHOT",
      "TOOL_CALL_START",
      "TOOL_CALL_ARGS",
      "TOOL_CALL_END",
      "RUN_FINISHED",
    ]);
    expect(result.receipt[5]).toBe(0);
  });

  it("verifies a signed MCP tool result and returns a typed host response", async () => {
    const keys = await generateEd25519KeyPair();
    const now = new Date("2026-07-31T21:00:00.000Z");
    const envelope = await signMeaningPacket(futureMeaningPacket, {
      issuer: "mcp:deployment-tool",
      audience: "juanpager:mcp-app",
      keyId: "key:test",
      privateKey: keys.privateKey,
      issuedAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
      nonce: "nonce:mcp:1",
    });
    const opened = await openMcpAppProposal({
      result: { structuredContent: { m1: envelope } },
      verification: {
        audience: "juanpager:mcp-app",
        keys: [{ issuer: "mcp:deployment-tool", keyId: "key:test", publicKey: keys.publicKey }],
        nonceStore: new MemoryNonceStore(),
        now,
        clockSkewMs: 0,
      },
    });
    const response = respondToMcpApproval({
      packet: opened.packet,
      actorId: "actor:human:test",
      actionId: "a:deploy",
      targetId: "e:release",
      decision: "approved",
      timestamp: "2026-07-31T21:00:10.000Z",
    });
    expect(opened.page.version).toBe("2.0");
    expect(response.structuredContent.protocol).toBe("m1");
    expect(response.structuredContent.delta[4][0]?.[0]).toBe(30);
  });
});
