import { beforeEach, describe, expect, it } from "vitest";
import {
  advanceAgentHumanSession,
  createAgentHumanSession,
  sessionLaunchUrl,
} from "../src/session/session";
import {
  AgentHumanSessionConflictError,
  BrowserAgentHumanSessionStore,
  MemoryAgentHumanSessionStore,
} from "../src/session/store";
import { validatePage } from "../src/schema/page";

const page = validatePage({
  version: "2.0",
  title: "Human decision",
  objects: [{ id: "decision", type: "request", name: "Approve the rollout" }],
});

beforeEach(() => localStorage.clear());

describe("durable agent-human sessions", () => {
  it("creates a revisioned semantic session and portable launch link", () => {
    const session = createAgentHumanSession({
      id: "session:test",
      document: page,
      source: { kind: "agent", agentId: "agent:ops", requestId: "request:1" },
      now: "2026-08-01T00:00:00.000Z",
    });
    expect(session.revision).toBe(0);
    expect(session.status).toBe("open");
    expect(session.document).toEqual(page);
    expect(sessionLaunchUrl(session.id, "https://example.com/juanpager")).toBe(
      "https://example.com/juanpager/#v=5&session=session%3Atest",
    );
  });

  it("enforces optimistic revision conflicts", async () => {
    const store = new MemoryAgentHumanSessionStore();
    const original = createAgentHumanSession({ id: "session:conflict", document: page });
    await store.put(original);
    const first = advanceAgentHumanSession(original, { status: "completed" });
    await store.put(first, original.revision);
    const stale = advanceAgentHumanSession(original, { status: "cancelled" });
    await expect(store.put(stale, original.revision)).rejects.toBeInstanceOf(AgentHumanSessionConflictError);
  });

  it("survives app restarts in browser storage", async () => {
    const store = new BrowserAgentHumanSessionStore();
    const original = createAgentHumanSession({ id: "session:offline", document: page });
    await store.put(original);
    const restored = await new BrowserAgentHumanSessionStore().get(original.id);
    expect(restored).toEqual(original);
  });
});
