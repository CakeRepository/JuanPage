import { isAllowedUrl } from "../schema/url.js";
import {
  validateAgentHumanSession,
  type AgentHumanSession,
} from "./session.js";

export interface AgentHumanSessionStore {
  readonly name: string;
  get(id: string): Promise<AgentHumanSession | undefined>;
  put(session: AgentHumanSession, expectedRevision?: number): Promise<AgentHumanSession>;
  delete(id: string): Promise<void>;
}

export class AgentHumanSessionConflictError extends Error {
  constructor(
    readonly sessionId: string,
    readonly expectedRevision: number,
    readonly actualRevision: number | undefined,
  ) {
    super(`JuanPager session ${sessionId} changed before this update could be saved.`);
    this.name = "AgentHumanSessionConflictError";
  }
}

export class MemoryAgentHumanSessionStore implements AgentHumanSessionStore {
  readonly name = "memory";
  private readonly sessions = new Map<string, AgentHumanSession>();

  async get(id: string): Promise<AgentHumanSession | undefined> {
    const session = this.sessions.get(id);
    return session ? structuredClone(session) : undefined;
  }

  async put(sessionInput: AgentHumanSession, expectedRevision?: number): Promise<AgentHumanSession> {
    const session = validateAgentHumanSession(sessionInput);
    const existing = this.sessions.get(session.id);
    if (expectedRevision !== undefined && existing?.revision !== expectedRevision) {
      throw new AgentHumanSessionConflictError(session.id, expectedRevision, existing?.revision);
    }
    this.sessions.set(session.id, structuredClone(session));
    return structuredClone(session);
  }

  async delete(id: string): Promise<void> {
    this.sessions.delete(id);
  }
}

export class BrowserAgentHumanSessionStore implements AgentHumanSessionStore {
  readonly name = "browser-local";
  constructor(private readonly prefix = "juanpager:session:") {}

  private key(id: string): string {
    return `${this.prefix}${id}`;
  }

  async get(id: string): Promise<AgentHumanSession | undefined> {
    const raw = localStorage.getItem(this.key(id));
    if (!raw) return undefined;
    return validateAgentHumanSession(JSON.parse(raw));
  }

  async put(sessionInput: AgentHumanSession, expectedRevision?: number): Promise<AgentHumanSession> {
    const session = validateAgentHumanSession(sessionInput);
    const existing = await this.get(session.id);
    if (expectedRevision !== undefined && existing?.revision !== expectedRevision) {
      throw new AgentHumanSessionConflictError(session.id, expectedRevision, existing?.revision);
    }
    localStorage.setItem(this.key(session.id), JSON.stringify(session));
    return session;
  }

  async delete(id: string): Promise<void> {
    localStorage.removeItem(this.key(id));
  }
}

export type HttpAgentHumanSessionStoreOptions = Readonly<{
  endpoint: string;
  headers?: Readonly<Record<string, string>>;
  credentials?: RequestCredentials;
}>;

export class HttpAgentHumanSessionStore implements AgentHumanSessionStore {
  readonly name = "http";
  private readonly endpoint: string;

  constructor(private readonly options: HttpAgentHumanSessionStoreOptions) {
    if (!isAllowedUrl(options.endpoint)) throw new Error("JuanPager session endpoint must use HTTPS or localhost.");
    this.endpoint = options.endpoint.endsWith("/") ? options.endpoint : `${options.endpoint}/`;
  }

  private url(id: string): string {
    return new URL(encodeURIComponent(id), this.endpoint).toString();
  }

  private headers(extra: Readonly<Record<string, string>> = {}): HeadersInit {
    return { "content-type": "application/json", ...(this.options.headers ?? {}), ...extra };
  }

  async get(id: string): Promise<AgentHumanSession | undefined> {
    const response = await fetch(this.url(id), {
      method: "GET",
      headers: this.headers(),
      credentials: this.options.credentials ?? "include",
      cache: "no-store",
    });
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(`JuanPager session load failed with HTTP ${response.status}.`);
    return validateAgentHumanSession(await response.json());
  }

  async put(sessionInput: AgentHumanSession, expectedRevision?: number): Promise<AgentHumanSession> {
    const session = validateAgentHumanSession(sessionInput);
    const response = await fetch(this.url(session.id), {
      method: "PUT",
      headers: this.headers(expectedRevision === undefined ? {} : { "if-match": String(expectedRevision) }),
      credentials: this.options.credentials ?? "include",
      cache: "no-store",
      body: JSON.stringify(session),
    });
    if (response.status === 409 || response.status === 412) {
      const actual = Number(response.headers.get("x-session-revision"));
      throw new AgentHumanSessionConflictError(session.id, expectedRevision ?? session.revision, Number.isFinite(actual) ? actual : undefined);
    }
    if (!response.ok) throw new Error(`JuanPager session save failed with HTTP ${response.status}.`);
    const body = await response.text();
    return body ? validateAgentHumanSession(JSON.parse(body)) : session;
  }

  async delete(id: string): Promise<void> {
    const response = await fetch(this.url(id), {
      method: "DELETE",
      headers: this.headers(),
      credentials: this.options.credentials ?? "include",
      cache: "no-store",
    });
    if (!response.ok && response.status !== 404) throw new Error(`JuanPager session delete failed with HTTP ${response.status}.`);
  }
}

export function configuredSessionEndpoint(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const value = (window as Window & {
    JUANPAGER_CONFIG?: { sessionEndpoint?: string };
  }).JUANPAGER_CONFIG?.sessionEndpoint;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function createConfiguredSessionStore(): AgentHumanSessionStore {
  const endpoint = configuredSessionEndpoint();
  return endpoint
    ? new HttpAgentHumanSessionStore({ endpoint })
    : new BrowserAgentHumanSessionStore();
}
