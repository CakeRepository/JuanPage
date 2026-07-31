import { base64UrlToBytes, bytesToBase64Url } from "./base64url.js";
import { gzipCompress, gzipDecompress } from "./compress.js";
import { LIMITS, LIMITS_HELP } from "../schema/limits.js";
import { validatePage, type JuanPageDocument } from "../schema/page.js";
import {
  applyMeaningDelta,
  browserRendererCapabilities,
  materializeMeaningPacket,
  validateActionReceipt,
  validateMeaningDelta,
  validateMeaningPacket,
  type ActionReceipt,
  type MeaningDelta,
  type MeaningPacket,
  type RendererCapabilities,
} from "../protocol/meaning.js";
import { materializeUntrustedMeaningPacket } from "../protocol/trust-projection.js";

export type PagePayloadEncoding = "gz" | "raw";
export const DEFAULT_PAGE_ENCODING: PagePayloadEncoding = "gz";

type MeaningEnvelope = { transport: "m1"; packet: MeaningPacket };

/**
 * A record-only browser exchange. The base packet remains immutable while
 * typed human deltas and action receipts accumulate for the return trip.
 * It is a transport envelope, never a second UI schema.
 */
export type MeaningSession = Readonly<{
  transport: "m1-session";
  packet: MeaningPacket;
  deltas: readonly MeaningDelta[];
  receipts: readonly ActionReceipt[];
}>;

export type DecodedPagePayload =
  | Readonly<{ kind: "juanpage"; page: JuanPageDocument }>
  | Readonly<{ kind: "m1"; page: JuanPageDocument; packet: MeaningPacket }>
  | Readonly<{
      kind: "m1-session";
      page: JuanPageDocument;
      session: MeaningSession;
      currentPacket: MeaningPacket;
    }>;

export class PagePayloadError extends Error {
  readonly details: string;
  constructor(message: string, details: string) {
    super(message);
    this.name = "PagePayloadError";
    this.details = details;
  }
}

const utf8Bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
const utf8Text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

function assertJsonSize(bytes: Uint8Array): void {
  if (bytes.byteLength > LIMITS.maxDecodedJsonBytes) {
    throw new PagePayloadError(
      "This JuanPage exceeds size limits.",
      `Decoded JSON is ${bytes.byteLength} bytes; maximum is ${LIMITS.maxDecodedJsonBytes}.\n${LIMITS_HELP}`,
    );
  }
}

function assertEncodedSize(encoded: string): void {
  const bytes = utf8Bytes(encoded).byteLength;
  if (bytes > LIMITS.maxEncodedFragmentBytes) {
    throw new PagePayloadError(
      "This JuanPage exceeds size limits.",
      `Encoded payload is ${bytes} bytes; maximum is ${LIMITS.maxEncodedFragmentBytes}.\n${LIMITS_HELP}`,
    );
  }
}

function looksGzipped(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

async function encodeJson(value: unknown, encoding: PagePayloadEncoding): Promise<string> {
  const jsonBytes = utf8Bytes(JSON.stringify(value));
  assertJsonSize(jsonBytes);
  const payloadBytes = encoding === "gz" ? await gzipCompress(jsonBytes) : jsonBytes;
  const encoded = bytesToBase64Url(payloadBytes);
  assertEncodedSize(encoded);
  return encoded;
}

async function decodeJson(payload: string, declared?: PagePayloadEncoding): Promise<unknown> {
  if (!payload) throw new PagePayloadError("Missing JuanPage data.", "The URL did not include a data payload.");
  assertEncodedSize(payload);

  let bytes: Uint8Array;
  try {
    bytes = base64UrlToBytes(payload);
  } catch (error) {
    throw new Error(`Invalid Base64URL payload: ${error instanceof Error ? error.message : String(error)}`);
  }

  const gzipped = looksGzipped(bytes);
  if (declared === "gz" && !gzipped) throw new Error("The link declares gzip but the payload is not gzip. It may be truncated.");

  let jsonBytes = bytes;
  if (gzipped) {
    try {
      jsonBytes = await gzipDecompress(bytes);
    } catch (error) {
      throw new Error(`Could not decompress this JuanPage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  assertJsonSize(jsonBytes);

  try {
    return JSON.parse(utf8Text(jsonBytes)) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSON in JuanPage payload: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function isMeaningEnvelope(input: unknown): input is MeaningEnvelope {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input)
    && (input as { transport?: unknown }).transport === "m1";
}

function isMeaningSessionEnvelope(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input)
    && (input as { transport?: unknown }).transport === "m1-session";
}

export function createMeaningSession(packetInput: MeaningPacket): MeaningSession {
  return {
    transport: "m1-session",
    packet: validateMeaningPacket(packetInput),
    deltas: [],
    receipts: [],
  };
}

export function validateMeaningSession(input: unknown): MeaningSession {
  if (!isMeaningSessionEnvelope(input)) {
    throw new PagePayloadError("This M1 session is invalid.", "Expected an m1-session transport envelope.");
  }
  const packet = validateMeaningPacket(input.packet);
  if (!Array.isArray(input.deltas) || !Array.isArray(input.receipts)) {
    throw new PagePayloadError("This M1 session is invalid.", "Session deltas and receipts must be arrays.");
  }

  let current = packet;
  const deltas = input.deltas.map((candidate, index) => {
    const delta = validateMeaningDelta(candidate);
    try {
      current = applyMeaningDelta(current, delta);
    } catch (error) {
      throw new PagePayloadError(
        "This M1 session is invalid.",
        `Delta ${index} does not continue the packet revision chain: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return delta;
  });

  const receipts = input.receipts.map((candidate, index) => {
    const receipt = validateActionReceipt(candidate);
    if (receipt[2] !== packet[1]) {
      throw new PagePayloadError(
        "This M1 session is invalid.",
        `Receipt ${index} belongs to packet ${receipt[2]}, not ${packet[1]}.`,
      );
    }
    return receipt;
  });

  return { transport: "m1-session", packet, deltas, receipts };
}

export function replayMeaningSession(input: unknown): MeaningPacket {
  const session = validateMeaningSession(input);
  return session.deltas.reduce<MeaningPacket>((packet, delta) => applyMeaningDelta(packet, delta), session.packet);
}

export function appendMeaningSessionDelta(
  sessionInput: unknown,
  deltaInput: unknown,
  receiptInput?: unknown,
): MeaningSession {
  const session = validateMeaningSession(sessionInput);
  const current = replayMeaningSession(session);
  const delta = validateMeaningDelta(deltaInput);
  applyMeaningDelta(current, delta);

  const receipts = [...session.receipts];
  if (receiptInput !== undefined) {
    const receipt = validateActionReceipt(receiptInput);
    if (receipt[2] !== session.packet[1]) {
      throw new PagePayloadError("This M1 receipt is invalid.", "The receipt packet id does not match the session packet.");
    }
    receipts.push(receipt);
  }

  return {
    transport: "m1-session",
    packet: session.packet,
    deltas: [...session.deltas, delta],
    receipts,
  };
}

function materializeRecordOnlySession(
  session: MeaningSession,
  capabilities: RendererCapabilities,
): { page: JuanPageDocument; currentPacket: MeaningPacket } {
  const currentPacket = replayMeaningSession(session);
  const projected = materializeMeaningPacket(currentPacket, capabilities);
  const allowedActions = (projected.actions ?? []).filter((action) => action.kind !== "open");
  const allowedActionIds = new Set(allowedActions.map((action) => action.id));
  const notice = "This is a record-only URL session. Your edits and decisions are stored as typed deltas in the Share link; nothing executes remotely from this page.";
  const page = validatePage({
    ...projected,
    description: projected.description ? `${projected.description} ${notice}` : notice,
    actions: allowedActions,
    objects: projected.objects.map((object) => ({
      ...object,
      actionIds: object.actionIds?.filter((actionId) => allowedActionIds.has(actionId)),
    })),
    metadata: {
      ...(projected.metadata ?? {}),
      "m1.trust": "draft",
      "m1.execution": "record-only",
      "m1.navigation": "disabled",
      "m1.sessionDeltas": session.deltas.length,
      "m1.sessionReceipts": session.receipts.length,
    },
  });
  return { page, currentPacket };
}

export async function encodePage(
  input: JuanPageDocument,
  encoding: PagePayloadEncoding = DEFAULT_PAGE_ENCODING,
): Promise<string> {
  return encodeJson(validatePage(input), encoding);
}

export async function encodeMeaningPacket(
  input: MeaningPacket,
  encoding: PagePayloadEncoding = DEFAULT_PAGE_ENCODING,
): Promise<string> {
  const packet = validateMeaningPacket(input);
  return encodeJson({ transport: "m1", packet } satisfies MeaningEnvelope, encoding);
}

export async function encodeMeaningSession(
  input: MeaningSession,
  encoding: PagePayloadEncoding = DEFAULT_PAGE_ENCODING,
): Promise<string> {
  return encodeJson(validateMeaningSession(input), encoding);
}

export async function decodePagePayload(
  payload: string,
  declared?: PagePayloadEncoding,
  capabilities: RendererCapabilities = browserRendererCapabilities(),
): Promise<DecodedPagePayload> {
  const parsed = await decodeJson(payload, declared);
  if (isMeaningSessionEnvelope(parsed)) {
    const session = validateMeaningSession(parsed);
    const { page, currentPacket } = materializeRecordOnlySession(session, capabilities);
    return { kind: "m1-session", page, session, currentPacket };
  }
  if (isMeaningEnvelope(parsed)) {
    const packet = validateMeaningPacket(parsed.packet);
    return { kind: "m1", packet, page: materializeUntrustedMeaningPacket(packet, capabilities) };
  }
  return { kind: "juanpage", page: validatePage(parsed) };
}

export async function decodePage(
  payload: string,
  declared?: PagePayloadEncoding,
  capabilities: RendererCapabilities = browserRendererCapabilities(),
): Promise<JuanPageDocument> {
  return (await decodePagePayload(payload, declared, capabilities)).page;
}

export async function encodePageToFragment(
  page: JuanPageDocument,
  encoding: PagePayloadEncoding = DEFAULT_PAGE_ENCODING,
): Promise<string> {
  return `#v=3&enc=${encoding}&data=${await encodePage(page, encoding)}`;
}

export async function encodeMeaningPacketToFragment(
  packet: MeaningPacket,
  encoding: PagePayloadEncoding = DEFAULT_PAGE_ENCODING,
): Promise<string> {
  return `#v=3&enc=${encoding}&data=${await encodeMeaningPacket(packet, encoding)}`;
}

export async function encodeMeaningSessionToFragment(
  session: MeaningSession,
  encoding: PagePayloadEncoding = DEFAULT_PAGE_ENCODING,
): Promise<string> {
  return `#v=4&enc=${encoding}&data=${await encodeMeaningSession(session, encoding)}`;
}

export async function buildPageShareUrl(
  page: JuanPageDocument,
  baseUrl: string,
  encoding: PagePayloadEncoding = DEFAULT_PAGE_ENCODING,
): Promise<string> {
  const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalized}${await encodePageToFragment(page, encoding)}`;
}

export async function buildMeaningShareUrl(
  packet: MeaningPacket,
  baseUrl: string,
  encoding: PagePayloadEncoding = DEFAULT_PAGE_ENCODING,
): Promise<string> {
  const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalized}${await encodeMeaningPacketToFragment(packet, encoding)}`;
}

export async function buildMeaningSessionShareUrl(
  session: MeaningSession,
  baseUrl: string,
  encoding: PagePayloadEncoding = DEFAULT_PAGE_ENCODING,
): Promise<string> {
  const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalized}${await encodeMeaningSessionToFragment(session, encoding)}`;
}

export function measurePageSizes(encoded: string, decoded: string): { encodedBytes: number; decodedBytes: number } {
  return { encodedBytes: utf8Bytes(encoded).byteLength, decodedBytes: utf8Bytes(decoded).byteLength };
}
