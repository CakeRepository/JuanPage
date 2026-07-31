import type { ActionMutation, ActionReceipt, MeaningDelta, MeaningPacket, RendererCapabilities } from "../protocol/meaning.js";

export type MeaningMessage =
  | Readonly<{ version: 1; kind: "delta"; payload: MeaningDelta }>
  | Readonly<{ version: 1; kind: "receipt"; payload: ActionReceipt }>
  | Readonly<{ version: 1; kind: "snapshot"; payload: MeaningPacket }>
  | Readonly<{ version: 1; kind: "capabilities"; payload: RendererCapabilities }>;

export interface MeaningTransport {
  readonly name: string;
  send(message: MeaningMessage): void | Promise<void>;
  close?(): void | Promise<void>;
}

export class MeaningTransportHub implements MeaningTransport {
  readonly name = "hub";
  constructor(private readonly transports: readonly MeaningTransport[]) {}

  async send(message: MeaningMessage): Promise<void> {
    const results = await Promise.allSettled(this.transports.map((transport) => transport.send(message)));
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failures.length > 0) throw new AggregateError(failures.map((failure) => failure.reason), "One or more meaning transports failed");
  }

  async close(): Promise<void> {
    await Promise.all(this.transports.map((transport) => transport.close?.()));
  }
}

function customEvent<T>(name: string, detail: T): Event {
  if (typeof CustomEvent !== "undefined") return new CustomEvent<T>(name, { detail });
  const event = new Event(name) as Event & { detail?: T };
  event.detail = detail;
  return event;
}

export function createBrowserEventTransport(target: EventTarget): MeaningTransport {
  return {
    name: "browser-event",
    send(message) {
      target.dispatchEvent(customEvent("juanpager:message", message));
      target.dispatchEvent(customEvent(`juanpager:${message.kind}`, message.payload));
    },
  };
}

export function createPostMessageTransport(
  target: Pick<Window, "postMessage">,
  targetOrigin: string,
): MeaningTransport {
  if (!targetOrigin) throw new Error("postMessage transport requires an explicit targetOrigin");
  return {
    name: "post-message",
    send(message) {
      target.postMessage({ channel: "juanpager:m1", message }, targetOrigin);
    },
  };
}

export function createHttpTransport(
  endpoint: string,
  fetcher: typeof fetch = fetch,
  headers: Readonly<Record<string, string>> = {},
): MeaningTransport {
  const url = new URL(endpoint);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("HTTP meaning transport requires HTTPS, except localhost");
  }
  return {
    name: "http",
    async send(message) {
      const actionMutation = message.kind === "delta"
        ? message.payload[4].find((mutation): mutation is ActionMutation => mutation[0] >= 30 && mutation[0] <= 34)
        : undefined;
      const idempotencyKey = message.kind === "delta"
        ? String(actionMutation?.[6] ?? `${message.payload[1]}:${message.payload[3]}`)
        : message.kind === "receipt"
          ? String(message.payload[7])
          : `${message.kind}:${Date.now()}`;
      const response = await fetcher(url, {
        method: "POST",
        headers: {
          "content-type": "application/vnd.juanpager.m1+json",
          "idempotency-key": idempotencyKey,
          ...headers,
        },
        body: JSON.stringify(message),
      });
      if (!response.ok) throw new Error(`Meaning transport failed with HTTP ${response.status}`);
    },
  };
}

export type WebSocketLike = Pick<WebSocket, "readyState" | "send" | "close">;

export function createWebSocketTransport(socket: WebSocketLike): MeaningTransport {
  return {
    name: "websocket",
    send(message) {
      if (socket.readyState !== 1) throw new Error("Meaning WebSocket is not open");
      socket.send(JSON.stringify(message));
    },
    close() {
      socket.close();
    },
  };
}

export function createMemoryTransport(): MeaningTransport & { readonly messages: MeaningMessage[] } {
  const messages: MeaningMessage[] = [];
  return {
    name: "memory",
    messages,
    send(message) {
      messages.push(message);
    },
  };
}

export const deltaMessage = (payload: MeaningDelta): MeaningMessage => ({ version: 1, kind: "delta", payload });
export const receiptMessage = (payload: ActionReceipt): MeaningMessage => ({ version: 1, kind: "receipt", payload });
export const snapshotMessage = (payload: MeaningPacket): MeaningMessage => ({ version: 1, kind: "snapshot", payload });
export const capabilityMessage = (payload: RendererCapabilities): MeaningMessage => ({ version: 1, kind: "capabilities", payload });
