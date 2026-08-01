import {
  createMeaningSession,
  type MeaningSession,
} from "../encoding/pagePipeline.js";
import type { MeaningDelta, MeaningPacket, RendererCapabilities } from "../protocol/meaning.js";
import { createActionDelta, materializeMeaningPacket } from "../protocol/meaning.js";
import type { SignedEnvelope, VerificationOptions } from "../protocol/envelope.js";
import { verifyMeaningPacket } from "../protocol/envelope.js";
import {
  createAgentHumanSession,
  sessionLaunchUrl,
  type AgentHumanSession,
} from "../session/session.js";
import type { AgentHumanSessionStore } from "../session/store.js";

export type McpToolResult = Readonly<{
  content?: readonly Readonly<{ type: "text"; text: string }>[];
  structuredContent?: Readonly<Record<string, unknown>>;
  _meta?: Readonly<Record<string, unknown>>;
}>;

export type McpAppApprovalResponse = Readonly<{
  content: readonly Readonly<{ type: "text"; text: string }>[];
  structuredContent: Readonly<{
    protocol: "m1";
    packetId: string;
    delta: MeaningDelta;
    decision: "proposed" | "approved" | "rejected";
  }>;
}>;

export type McpHumanHandoff = Readonly<{
  session: AgentHumanSession;
  launchUrl: string;
  result: McpToolResult;
}>;

export function meaningPacketFromMcpToolResult(result: McpToolResult): SignedEnvelope<MeaningPacket> {
  const candidate = result.structuredContent?.["m1"] ?? result._meta?.["m1"];
  if (!candidate || typeof candidate !== "object") throw new Error("MCP tool result does not contain a signed M1 envelope.");
  return candidate as SignedEnvelope<MeaningPacket>;
}

export async function openMcpAppProposal(input: Readonly<{
  result: McpToolResult;
  verification: VerificationOptions;
  capabilities?: RendererCapabilities;
}>): Promise<Readonly<{ packet: MeaningPacket; page: ReturnType<typeof materializeMeaningPacket> }>> {
  const packet = await verifyMeaningPacket(meaningPacketFromMcpToolResult(input.result), input.verification);
  return { packet, page: materializeMeaningPacket(packet, input.capabilities) };
}

export async function createMcpHumanHandoff(input: Readonly<{
  result: McpToolResult;
  verification: VerificationOptions;
  store: AgentHumanSessionStore;
  appBaseUrl: string;
  capabilities?: RendererCapabilities;
  agentId?: string;
  toolName?: string;
  requestId?: string;
  returnUrl?: string;
  expiresAt?: string;
}>): Promise<McpHumanHandoff> {
  const { packet, page } = await openMcpAppProposal(input);
  const meaning = createMeaningSession(packet);
  const session = createAgentHumanSession({
    document: page,
    meaning,
    expiresAt: input.expiresAt,
    source: {
      kind: "mcp",
      agentId: input.agentId,
      toolName: input.toolName,
      requestId: input.requestId,
      returnUrl: input.returnUrl,
    },
    metadata: {
      "mcp.packetRevision": packet[2],
      "mcp.requiresHuman": true,
    },
  });
  await input.store.put(session);
  const launchUrl = sessionLaunchUrl(session.id, input.appBaseUrl);
  return {
    session,
    launchUrl,
    result: {
      content: [{ type: "text", text: "Human input is requested in JuanPager." }],
      structuredContent: {
        protocol: "juanpage-session",
        sessionId: session.id,
        revision: session.revision,
        launchUrl,
      },
      _meta: {
        "openai/outputTemplate": launchUrl,
        "juanpager/session": session.id,
      },
    },
  };
}

export function mcpResultFromHumanSession(session: AgentHumanSession): McpToolResult {
  const meaning: MeaningSession | undefined = session.meaning;
  return {
    content: [{
      type: "text",
      text: `JuanPager human session ${session.id} is ${session.status} at revision ${session.revision}.`,
    }],
    structuredContent: {
      protocol: "juanpage-session",
      sessionId: session.id,
      revision: session.revision,
      status: session.status,
      page: session.document,
      deltas: meaning?.deltas ?? [],
      receipts: meaning?.receipts ?? [],
    },
  };
}

export function respondToMcpApproval(input: Readonly<{
  packet: MeaningPacket;
  actorId: string;
  actionId: string;
  targetId: string | null;
  decision: "proposed" | "approved" | "rejected";
  arguments?: Readonly<Record<string, string | number | boolean | null>>;
  timestamp: string;
}>): McpAppApprovalResponse {
  const policy = input.decision === "proposed" ? "approval" : "allow";
  const delta = createActionDelta(
    input.packet[1],
    input.packet[2],
    input.actorId,
    input.actionId,
    input.targetId,
    { ...(input.arguments ?? {}), decision: input.decision },
    policy,
    { timestamp: input.timestamp },
  );
  return {
    content: [{ type: "text", text: `JuanPager decision: ${input.decision}` }],
    structuredContent: { protocol: "m1", packetId: input.packet[1], delta, decision: input.decision },
  };
}
