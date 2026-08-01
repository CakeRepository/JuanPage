import { describe, expect, it } from "vitest";
import { mcpResultFromHumanSession } from "../src/adapters/mcp-app";
import { createAgentHumanSession } from "../src/session/session";
import { validatePage } from "../src/schema/page";

const page = validatePage({
  version: "2.0",
  title: "Choose a deployment ring",
  objects: [{ id: "deployment", type: "deployment", name: "Agent rollout" }],
});

describe("MCP human session return", () => {
  it("returns the final semantic page and typed session status to the agent", () => {
    const session = createAgentHumanSession({
      id: "session:mcp:return",
      document: page,
      source: { kind: "mcp", toolName: "deploy_agent", requestId: "req:42" },
      now: "2026-08-01T00:00:00.000Z",
    });
    const result = mcpResultFromHumanSession({ ...session, status: "completed" });
    expect(result.structuredContent?.protocol).toBe("juanpage-session");
    expect(result.structuredContent?.status).toBe("completed");
    expect(result.structuredContent?.page).toEqual(page);
  });
});
