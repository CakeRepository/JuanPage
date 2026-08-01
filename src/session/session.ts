import {
  createMeaningSession,
  validateMeaningSession,
  type MeaningSession,
} from "../encoding/pagePipeline.js";
import type { MeaningPacket } from "../protocol/meaning.js";
import {
  validatePage,
  type JuanPageDocument,
  type PageScalar,
} from "../schema/page.js";
import { isAllowedUrl } from "../schema/url.js";

export type AgentHumanSessionStatus = "open" | "completed" | "cancelled" | "expired";
export type AgentHumanSessionSource = Readonly<{
  kind: "mcp" | "agent" | "human" | "system";
  agentId?: string;
  toolName?: string;
  requestId?: string;
  returnUrl?: string;
}>;

export type AgentHumanSession = Readonly<{
  version: 1;
  id: string;
  revision: number;
  status: AgentHumanSessionStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  document: JuanPageDocument;
  meaning?: MeaningSession;
  source?: AgentHumanSessionSource;
  metadata?: Readonly<Record<string, PageScalar>>;
}>;

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const statuses: readonly AgentHumanSessionStatus[] = ["open", "completed", "cancelled", "expired"];
const sourceKinds: readonly AgentHumanSessionSource["kind"][] = ["mcp", "agent", "human", "system"];

function fail(message: string): never {
  throw new Error(`Invalid JuanPager session: ${message}`);
}

function assertId(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || !idPattern.test(value)) fail(`${name} must be an opaque id`);
}

function assertIso(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) fail(`${name} must be an ISO timestamp`);
}

function scalar(value: unknown): value is PageScalar {
  return value === null
    || typeof value === "string"
    || typeof value === "boolean"
    || (typeof value === "number" && Number.isFinite(value));
}

function validateSource(value: unknown): AgentHumanSessionSource | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("source must be an object");
  const source = value as Record<string, unknown>;
  if (!sourceKinds.includes(source.kind as AgentHumanSessionSource["kind"])) fail("source.kind is unsupported");
  for (const key of ["agentId", "toolName", "requestId"] as const) {
    if (source[key] !== undefined && typeof source[key] !== "string") fail(`source.${key} must be text`);
  }
  if (source.returnUrl !== undefined) {
    if (typeof source.returnUrl !== "string" || !isAllowedUrl(source.returnUrl)) fail("source.returnUrl must be a safe HTTPS URL");
  }
  return {
    kind: source.kind as AgentHumanSessionSource["kind"],
    agentId: source.agentId as string | undefined,
    toolName: source.toolName as string | undefined,
    requestId: source.requestId as string | undefined,
    returnUrl: source.returnUrl as string | undefined,
  };
}

function validateMetadata(value: unknown): Readonly<Record<string, PageScalar>> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("metadata must be an object");
  const entries = Object.entries(value);
  if (entries.length > 50 || !entries.every(([key, entry]) => idPattern.test(key) && scalar(entry))) {
    fail("metadata must contain at most 50 scalar entries with opaque keys");
  }
  return Object.fromEntries(entries) as Record<string, PageScalar>;
}

function generatedSessionId(): string {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject?.randomUUID) return `session:${cryptoObject.randomUUID()}`;
  return `session:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 12)}`;
}

export function validateAgentHumanSession(input: unknown): AgentHumanSession {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("expected a session object");
  const value = input as Record<string, unknown>;
  if (value.version !== 1) fail("version must be 1");
  assertId(value.id, "id");
  if (!Number.isInteger(value.revision) || Number(value.revision) < 0) fail("revision must be a non-negative integer");
  if (!statuses.includes(value.status as AgentHumanSessionStatus)) fail("status is unsupported");
  assertIso(value.createdAt, "createdAt");
  assertIso(value.updatedAt, "updatedAt");
  if (value.expiresAt !== undefined) assertIso(value.expiresAt, "expiresAt");
  const document = validatePage(value.document);
  const meaning = value.meaning === undefined ? undefined : validateMeaningSession(value.meaning);
  return {
    version: 1,
    id: value.id,
    revision: Number(value.revision),
    status: value.status as AgentHumanSessionStatus,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    expiresAt: value.expiresAt as string | undefined,
    document,
    meaning,
    source: validateSource(value.source),
    metadata: validateMetadata(value.metadata),
  };
}

export function createAgentHumanSession(input: Readonly<{
  document: JuanPageDocument;
  meaning?: MeaningSession;
  packet?: MeaningPacket;
  id?: string;
  expiresAt?: string;
  source?: AgentHumanSessionSource;
  metadata?: Readonly<Record<string, PageScalar>>;
  now?: string;
}>): AgentHumanSession {
  const now = input.now ?? new Date().toISOString();
  const meaning = input.meaning ?? (input.packet ? createMeaningSession(input.packet) : undefined);
  return validateAgentHumanSession({
    version: 1,
    id: input.id ?? generatedSessionId(),
    revision: 0,
    status: "open",
    createdAt: now,
    updatedAt: now,
    expiresAt: input.expiresAt,
    document: input.document,
    meaning,
    source: input.source,
    metadata: input.metadata,
  });
}

export function advanceAgentHumanSession(
  sessionInput: AgentHumanSession,
  update: Readonly<{
    document?: JuanPageDocument;
    meaning?: MeaningSession;
    status?: AgentHumanSessionStatus;
    metadata?: Readonly<Record<string, PageScalar>>;
    now?: string;
  }>,
  expectedRevision = sessionInput.revision,
): AgentHumanSession {
  const session = validateAgentHumanSession(sessionInput);
  if (session.revision !== expectedRevision) {
    throw new Error(`JuanPager session revision conflict: expected ${expectedRevision}, found ${session.revision}`);
  }
  return validateAgentHumanSession({
    ...session,
    revision: session.revision + 1,
    updatedAt: update.now ?? new Date().toISOString(),
    document: update.document ?? session.document,
    meaning: update.meaning ?? session.meaning,
    status: update.status ?? session.status,
    metadata: update.metadata ?? session.metadata,
  });
}

export function agentHumanSessionExpired(session: AgentHumanSession, now = Date.now()): boolean {
  return Boolean(session.expiresAt && Date.parse(session.expiresAt) <= now);
}

export function sessionLaunchUrl(sessionId: string, baseUrl: string): string {
  assertId(sessionId, "sessionId");
  const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalized}#v=5&session=${encodeURIComponent(sessionId)}`;
}
