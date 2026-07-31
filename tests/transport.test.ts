import { describe, expect, it, vi } from "vitest";
import { createActionDelta, createActionReceipt } from "../src/protocol/meaning";
import {
  createBrowserEventTransport,
  createHttpTransport,
  createMemoryTransport,
  deltaMessage,
  MeaningTransportHub,
  receiptMessage,
} from "../src/transport/adapters";

describe("M1 transports", () => {
  it("broadcasts deltas and receipts through a hub", async () => {
    const first = createMemoryTransport();
    const second = createMemoryTransport();
    const hub = new MeaningTransportHub([first, second]);
    const delta = createActionDelta("pkt:test", 0, "actor:test", "a:run", null);
    const receipt = createActionReceipt(delta, "authorized");
    await hub.send(deltaMessage(delta));
    await hub.send(receiptMessage(receipt));
    expect(first.messages).toHaveLength(2);
    expect(second.messages).toEqual(first.messages);
  });

  it("emits specific and generic browser events", () => {
    const target = new EventTarget();
    const seen: string[] = [];
    target.addEventListener("juanpager:message", () => seen.push("message"));
    target.addEventListener("juanpager:delta", () => seen.push("delta"));
    const transport = createBrowserEventTransport(target);
    transport.send(deltaMessage(createActionDelta("pkt:test", 0, "actor:test", "a:run", null)));
    expect(seen).toEqual(["message", "delta"]);
  });

  it("requires secure HTTP endpoints and sends idempotency", async () => {
    expect(() => createHttpTransport("http://example.com/m1")).toThrow(/HTTPS/);
    const fetcher = vi.fn(async () => new Response(null, { status: 202 }));
    const transport = createHttpTransport("https://example.com/m1", fetcher as typeof fetch);
    await transport.send(deltaMessage(createActionDelta("pkt:test", 0, "actor:test", "a:run", null)));
    expect(fetcher).toHaveBeenCalledOnce();
    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["idempotency-key"]).toContain("idem:");
  });
});
