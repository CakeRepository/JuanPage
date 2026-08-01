import { describe, expect, it, vi } from "vitest";
import {
  WebhookAgentHumanNotifier,
  notificationForAgentHumanSession,
  notifyAgentHumanSession,
} from "../src/notification/notification";
import { createAgentHumanSession } from "../src/session/session";

function sessionFixture() {
  return createAgentHumanSession({
    id: "session:notify:test",
    now: "2026-07-31T22:00:00.000Z",
    expiresAt: "2026-08-01T22:00:00.000Z",
    document: {
      version: "2.0",
      title: "Production approval",
      intent: "Review the rollout before the agent continues.",
      objects: [{ id: "deployment:1", type: "deployment", name: "Agent rollout" }],
    },
  });
}

describe("agent-human notifications", () => {
  it("creates a deterministic notification that opens the durable session", () => {
    const notification = notificationForAgentHumanSession({
      session: sessionFixture(),
      appBaseUrl: "https://app.example/juanpager/",
      urgency: "high",
    });

    expect(notification.id).toBe("notification:session:notify:test:0");
    expect(notification.sessionId).toBe("session:notify:test");
    expect(notification.launchUrl).toBe("https://app.example/juanpager/#v=5&session=session%3Anotify%3Atest");
    expect(notification.title).toBe("Production approval");
    expect(notification.body).toBe("Review the rollout before the agent continues.");
    expect(notification.urgency).toBe("high");
  });

  it("delivers the same data-only notification through a host webhook", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ id: "provider:42" }),
      { status: 202, headers: { "content-type": "application/json" } },
    ));
    const notifier = new WebhookAgentHumanNotifier({
      endpoint: "https://notify.example/juanpager",
      headers: { authorization: "Bearer test" },
      fetcher,
    });

    const receipt = await notifyAgentHumanSession({
      session: sessionFixture(),
      appBaseUrl: "https://app.example/juanpager/",
      notifier,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://notify.example/juanpager");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      version: 1,
      sessionId: "session:notify:test",
      launchUrl: "https://app.example/juanpager/#v=5&session=session%3Anotify%3Atest",
    });
    expect(receipt.channel).toBe("webhook");
    expect(receipt.providerId).toBe("provider:42");
  });

  it("rejects unsafe notification endpoints", () => {
    expect(() => new WebhookAgentHumanNotifier({ endpoint: "http://notify.example/hook" })).toThrow();
  });
});
