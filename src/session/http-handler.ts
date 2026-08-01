import {
  agentHumanSessionExpired,
  validateAgentHumanSession,
  type AgentHumanSession,
  type AgentHumanSessionStatus,
} from "./session.js";
import {
  AgentHumanSessionConflictError,
  type AgentHumanSessionStore,
} from "./store.js";

export type AgentHumanSessionPrincipal = Readonly<{
  subject: string;
  tenantId: string;
}>;

export type AgentHumanSessionAuthorizer = (
  request: Request,
) => AgentHumanSessionPrincipal | undefined | Promise<AgentHumanSessionPrincipal | undefined>;

export type AgentHumanSessionHttpHandlerOptions = Readonly<{
  store: AgentHumanSessionStore;
  authorize: AgentHumanSessionAuthorizer;
  pathPrefix?: string;
  allowedOrigins?: readonly string[];
  maxBodyBytes?: number;
  tenantMetadataKey?: string;
  subjectMetadataKey?: string;
  now?: () => number;
}>;

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const metadataKeyPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function normalizedPrefix(value: string | undefined): string {
  const prefix = value?.trim() || "/sessions";
  if (!prefix.startsWith("/")) throw new Error("Session HTTP pathPrefix must start with a slash.");
  return prefix.length > 1 && prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
}

function parseSessionId(request: Request, prefix: string): string | undefined {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith(`${prefix}/`)) return undefined;
  const encoded = pathname.slice(prefix.length + 1);
  if (!encoded || encoded.includes("/")) return undefined;
  try {
    const id = decodeURIComponent(encoded);
    return idPattern.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

function parseIfMatch(value: string | null): number | undefined {
  if (!value) return undefined;
  const normalized = value.trim().replace(/^W\//u, "").replace(/^"|"$/gu, "");
  if (!/^\d+$/u.test(normalized)) return undefined;
  return Number(normalized);
}

function transitionAllowed(from: AgentHumanSessionStatus, to: AgentHumanSessionStatus): boolean {
  if (from === "expired" || from === "cancelled") return from === to;
  if (from === "completed") return to === "completed";
  return to === "open" || to === "completed" || to === "cancelled" || to === "expired";
}

function tenantOf(session: AgentHumanSession, key: string): string | undefined {
  const value = session.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function responseHeaders(
  request: Request,
  options: AgentHumanSessionHttpHandlerOptions,
  revision?: number,
): Headers {
  const headers = new Headers({
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  if (revision !== undefined) {
    headers.set("etag", `"${revision}"`);
    headers.set("x-session-revision", String(revision));
  }
  const origin = request.headers.get("origin");
  if (origin && options.allowedOrigins?.includes(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
    headers.set("vary", "Origin");
  }
  return headers;
}

function jsonResponse(
  request: Request,
  options: AgentHumanSessionHttpHandlerOptions,
  status: number,
  body: unknown,
  revision?: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(request, options, revision),
  });
}

function errorResponse(
  request: Request,
  options: AgentHumanSessionHttpHandlerOptions,
  status: number,
  error: string,
  revision?: number,
): Response {
  return jsonResponse(request, options, status, { error }, revision);
}

function validPrincipal(value: AgentHumanSessionPrincipal | undefined): value is AgentHumanSessionPrincipal {
  return Boolean(value?.subject.trim() && value.tenantId.trim());
}

export function createAgentHumanSessionHttpHandler(
  options: AgentHumanSessionHttpHandlerOptions,
): (request: Request) => Promise<Response> {
  const prefix = normalizedPrefix(options.pathPrefix);
  const maxBodyBytes = options.maxBodyBytes ?? 1_000_000;
  const tenantKey = options.tenantMetadataKey ?? "tenant.id";
  const subjectKey = options.subjectMetadataKey ?? "owner.subject";
  if (!metadataKeyPattern.test(tenantKey) || !metadataKeyPattern.test(subjectKey)) {
    throw new Error("Session tenant and subject metadata keys must be opaque identifiers.");
  }

  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    if (origin && options.allowedOrigins && !options.allowedOrigins.includes(origin)) {
      return errorResponse(request, options, 403, "Origin is not allowed.");
    }
    if (request.method === "OPTIONS") {
      const headers = responseHeaders(request, options);
      headers.set("access-control-allow-methods", "GET, PUT, DELETE, OPTIONS");
      headers.set("access-control-allow-headers", "authorization, content-type, if-match");
      headers.set("access-control-max-age", "600");
      return new Response(null, { status: 204, headers });
    }

    const sessionId = parseSessionId(request, prefix);
    if (!sessionId) return errorResponse(request, options, 404, "Session route was not found.");

    const principal = await options.authorize(request);
    if (!validPrincipal(principal)) {
      return errorResponse(request, options, 401, "Authentication is required.");
    }

    try {
      const existing = await options.store.get(sessionId);
      if (existing && tenantOf(existing, tenantKey) !== principal.tenantId) {
        return errorResponse(request, options, 404, "Session was not found.");
      }

      if (request.method === "GET") {
        if (!existing) return errorResponse(request, options, 404, "Session was not found.");
        if (agentHumanSessionExpired(existing, options.now?.() ?? Date.now())) {
          return errorResponse(request, options, 410, "Session has expired.", existing.revision);
        }
        return jsonResponse(request, options, 200, existing, existing.revision);
      }

      if (request.method === "DELETE") {
        if (!existing) return new Response(null, { status: 204, headers: responseHeaders(request, options) });
        await options.store.delete(sessionId);
        return new Response(null, { status: 204, headers: responseHeaders(request, options) });
      }

      if (request.method !== "PUT") {
        return errorResponse(request, options, 405, "Method is not allowed.");
      }

      const contentLength = Number(request.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
        return errorResponse(request, options, 413, "Session payload is too large.");
      }
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > maxBodyBytes) {
        return errorResponse(request, options, 413, "Session payload is too large.");
      }

      let candidate: AgentHumanSession;
      try {
        candidate = validateAgentHumanSession(JSON.parse(raw));
      } catch (error) {
        return errorResponse(
          request,
          options,
          400,
          error instanceof Error ? error.message : "Session payload is invalid.",
        );
      }
      if (candidate.id !== sessionId) {
        return errorResponse(request, options, 400, "Session id does not match the request path.");
      }

      if (!existing) {
        if (candidate.revision !== 0) {
          return errorResponse(request, options, 409, "A new session must begin at revision 0.");
        }
      } else {
        const expectedRevision = parseIfMatch(request.headers.get("if-match"));
        if (expectedRevision === undefined) {
          return errorResponse(request, options, 428, "If-Match is required for session updates.", existing.revision);
        }
        if (expectedRevision !== existing.revision) {
          return errorResponse(request, options, 412, "Session revision does not match.", existing.revision);
        }
        if (candidate.revision !== existing.revision + 1) {
          return errorResponse(request, options, 409, "Session updates must advance exactly one revision.", existing.revision);
        }
        if (candidate.createdAt !== existing.createdAt) {
          return errorResponse(request, options, 409, "Session creation time is immutable.", existing.revision);
        }
        if (!transitionAllowed(existing.status, candidate.status)) {
          return errorResponse(request, options, 409, "Session status transition is not allowed.", existing.revision);
        }
      }

      const normalized = validateAgentHumanSession({
        ...candidate,
        metadata: {
          ...(candidate.metadata ?? {}),
          [tenantKey]: principal.tenantId,
          [subjectKey]: existing?.metadata?.[subjectKey] ?? principal.subject,
        },
      });
      const saved = await options.store.put(normalized, existing?.revision);
      return jsonResponse(request, options, existing ? 200 : 201, saved, saved.revision);
    } catch (error) {
      if (error instanceof AgentHumanSessionConflictError) {
        return errorResponse(request, options, 412, error.message, error.actualRevision);
      }
      return errorResponse(
        request,
        options,
        500,
        error instanceof Error ? error.message : "Session service failed.",
      );
    }
  };
}
