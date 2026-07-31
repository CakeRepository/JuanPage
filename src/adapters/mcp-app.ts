import type { MeaningDelta, MeaningPacket, RendererCapabilities } from "../protocol/meaning.js";
import { createActionDelta, materializeMeaningPacket } from "../protocol/meaning.js";
import type { SignedEnvelope, VerificationOptions } from "../protocol/envelope.js";
import { verifyMeaningPacket } from "../protocol/envelope.js";

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
