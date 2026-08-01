import { isAllowedUrl } from "../schema/url.js";
import {
  sessionLaunchUrl,
  validateAgentHumanSession,
  type AgentHumanSession,
} from "../session/session.js";

export type AgentHumanNotificationUrgency = "low" | "normal" | "high";

export type AgentHumanNotification = Readonly<{
  version: 1;
  id: string;
  sessionId: string;
  title: string;
  body: string;
  launchUrl: string;
  urgency: AgentHumanNotificationUrgency;
  expiresAt?: string;
}>;

export type AgentHumanNotificationReceipt = Readonly<{
  notificationId: string;
  sessionId: string;
  channel: string;
  deliveredAt: string;
  providerId?: string;
}>;

export interface AgentHumanNotifier {
  readonly name: string;
  notify(notification: AgentHumanNotification): Promise<AgentHumanNotificationReceipt>;
}

export function notificationForAgentHumanSession(input: Readonly<{
  session: AgentHumanSession;
  appBaseUrl: string;
  title?: string;
  body?: string;
  urgency?: AgentHumanNotificationUrgency;
}>): AgentHumanNotification {
  const session = validateAgentHumanSession(input.session);
  const launchUrl = sessionLaunchUrl(session.id, input.appBaseUrl);
  return {
    version: 1,
    id: `notification:${session.id}:${session.revision}`,
    sessionId: session.id,
    title: input.title ?? session.document.title,
    body: input.body ?? session.document.intent ?? "Human input is requested in JuanPager.",
    launchUrl,
    urgency: input.urgency ?? "normal",
    expiresAt: session.expiresAt,
  };
}

export async function notifyAgentHumanSession(input: Readonly<{
  session: AgentHumanSession;
  appBaseUrl: string;
  notifier: AgentHumanNotifier;
  title?: string;
  body?: string;
  urgency?: AgentHumanNotificationUrgency;
}>): Promise<AgentHumanNotificationReceipt> {
  return input.notifier.notify(notificationForAgentHumanSession(input));
}

export class BrowserAgentHumanNotifier implements AgentHumanNotifier {
  readonly name = "browser-notification";

  async notify(notification: AgentHumanNotification): Promise<AgentHumanNotificationReceipt> {
    if (typeof Notification === "undefined") {
      throw new Error("Browser notifications are not available in this runtime.");
    }
    let permission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Browser notification permission was not granted.");

    const options: NotificationOptions = {
      body: notification.body,
      tag: notification.sessionId,
      data: { launchUrl: notification.launchUrl, sessionId: notification.sessionId },
    };
    if (typeof navigator !== "undefined" && navigator.serviceWorker) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(notification.title, options);
    } else {
      new Notification(notification.title, options);
    }
    return {
      notificationId: notification.id,
      sessionId: notification.sessionId,
      channel: this.name,
      deliveredAt: new Date().toISOString(),
    };
  }
}

export type WebhookAgentHumanNotifierOptions = Readonly<{
  endpoint: string;
  headers?: Readonly<Record<string, string>>;
  fetcher?: typeof fetch;
}>;

export class WebhookAgentHumanNotifier implements AgentHumanNotifier {
  readonly name = "webhook";
  private readonly endpoint: string;
  private readonly fetcher: typeof fetch;

  constructor(private readonly options: WebhookAgentHumanNotifierOptions) {
    if (!isAllowedUrl(options.endpoint)) {
      throw new Error("JuanPager notification webhook must use HTTPS or localhost.");
    }
    this.endpoint = options.endpoint;
    this.fetcher = options.fetcher ?? fetch;
  }

  async notify(notification: AgentHumanNotification): Promise<AgentHumanNotificationReceipt> {
    const response = await this.fetcher(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", ...(this.options.headers ?? {}) },
      body: JSON.stringify(notification),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`JuanPager notification delivery failed with HTTP ${response.status}.`);
    }
    let providerId: string | undefined;
    const responseType = response.headers.get("content-type") ?? "";
    if (responseType.includes("application/json")) {
      const result = await response.json() as { id?: unknown };
      if (typeof result.id === "string") providerId = result.id;
    }
    return {
      notificationId: notification.id,
      sessionId: notification.sessionId,
      channel: this.name,
      deliveredAt: new Date().toISOString(),
      providerId,
    };
  }
}
