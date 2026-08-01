import { describe, expect, it } from "vitest";
import { createAgentHumanSession, advanceAgentHumanSession } from "../src/session/session";
import { createAgentHumanSessionHttpHandler } from "../src/session/http-handler";
import { MemoryAgentHumanSessionStore } from "../src/session/store";

function principalFromRequest(request: Request) {
  const token = request.headers.get("authorization");
  if (token === "Bearer tenant-a") return { subject: "user:alice", tenantId: "tenant:a" };
  if (token === "Bearer tenant-b") return { subject: "user:bob", tenantId: "tenant:b" };
  return undefined;
}

function sessionFixture() {
  return createAgentHumanSession({
    id: "session:http:test",
    now: "2026-07-31T22:00:00.000Z",
    document: {
      version: "2.0",
      title: "Review deployment",
      intent: "Approve or reject a production rollout.",
      objects: [{ id: "deployment:1", type: "deployment", name: "Agent rollout" }],
    },
  });
}

function request(method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request("https://api.example/sessions/session%3Ahttp%3Atest", {
    method,
    headers: {
      authorization: "Bearer tenant-a",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("agent-human session HTTP handler", () => {
  it("creates, isolates, and revision-controls durable sessions", async () => {
    const store = new MemoryAgentHumanSessionStore();
    const handler = createAgentHumanSessionHttpHandler({
      store,
      authorize: principalFromRequest,
      allowedOrigins: ["https://app.example"],
      now: () => Date.parse("2026-07-31T22:10:00.000Z"),
    });

    const createdResponse = await handler(request("PUT", sessionFixture()));
    expect(createdResponse.status).toBe(201);
    expect(createdResponse.headers.get("etag")).toBe('"0"');
    const created = await createdResponse.json();
    expect(created.metadata["tenant.id"]).toBe("tenant:a");
    expect(created.metadata["owner.subject"]).toBe("user:alice");

    const hidden = await handler(new Request(
      "https://api.example/sessions/session%3Ahttp%3Atest",
      { headers: { authorization: "Bearer tenant-b" } },
    ));
    expect(hidden.status).toBe(404);

    const completed = advanceAgentHumanSession(created, {
      status: "completed",
      now: "2026-07-31T22:05:00.000Z",
    }, created.revision);
    const updatedResponse = await handler(request("PUT", completed, { "if-match": '"0"' }));
    expect(updatedResponse.status).toBe(200);
    expect(updatedResponse.headers.get("x-session-revision")).toBe("1");
    const updated = await updatedResponse.json();
    expect(updated.status).toBe("completed");

    const staleResponse = await handler(request("PUT", completed, { "if-match": '"0"' }));
    expect(staleResponse.status).toBe(412);
    expect(staleResponse.headers.get("x-session-revision")).toBe("1");

    const reopened = advanceAgentHumanSession(updated, {
      status: "open",
      now: "2026-07-31T22:06:00.000Z",
    }, updated.revision);
    const invalidTransition = await handler(request("PUT", reopened, { "if-match": '"1"' }));
    expect(invalidTransition.status).toBe(409);
  });

  it("requires authentication and update preconditions", async () => {
    const handler = createAgentHumanSessionHttpHandler({
      store: new MemoryAgentHumanSessionStore(),
      authorize: principalFromRequest,
    });
    const anonymous = await handler(new Request(
      "https://api.example/sessions/session%3Ahttp%3Atest",
      { method: "PUT", body: JSON.stringify(sessionFixture()) },
    ));
    expect(anonymous.status).toBe(401);

    const created = await handler(request("PUT", sessionFixture()));
    const stored = await created.json();
    const completed = advanceAgentHumanSession(stored, { status: "completed" }, stored.revision);
    const noPrecondition = await handler(request("PUT", completed));
    expect(noPrecondition.status).toBe(428);
  });
});
