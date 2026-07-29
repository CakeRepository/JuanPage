import {
  validateAnyDocument,
  type LoadedDocument,
} from "../schema/anyDocument.js";
import { validateDocument, type JuanPagerDocument } from "../schema/document.js";
import { LIMITS, LIMITS_HELP } from "../schema/limits.js";
import { validateMoment, type JuanPagerMomentDoc } from "../schema/moment.js";
import { base64UrlToBytes, bytesToBase64Url } from "./base64url.js";
import { fromCompactDocument, toCompactDocument } from "./compact.js";
import { fromCompactMoment, toCompactMoment } from "./compactMoment.js";
import { gzipCompress, gzipDecompress } from "./compress.js";

/**
 * `gz` keeps links short (compact keys + gzip). `raw` trades size for
 * inspectability: the payload is plain JSON, so failures are obvious.
 */
export type PayloadEncoding = "gz" | "raw";

export const DEFAULT_ENCODING: PayloadEncoding = "gz";

export class PayloadLimitError extends Error {
  readonly details: string;

  constructor(message: string, details: string) {
    super(message);
    this.name = "PayloadLimitError";
    this.details = details;
  }
}

function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function utf8Text(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function assertJsonSize(bytes: Uint8Array): void {
  if (bytes.byteLength > LIMITS.maxDecodedJsonBytes) {
    throw new PayloadLimitError(
      "This JuanPager document exceeds size limits.",
      `Decoded JSON is ${bytes.byteLength} bytes; maximum is ${LIMITS.maxDecodedJsonBytes}.\n${LIMITS_HELP}`,
    );
  }
}

function assertEncodedSize(encoded: string): void {
  const size = utf8Bytes(encoded).byteLength;
  if (size > LIMITS.maxEncodedFragmentBytes) {
    throw new PayloadLimitError(
      "This JuanPager document exceeds size limits.",
      `Encoded fragment is ${size} bytes; maximum is ${LIMITS.maxEncodedFragmentBytes}.\n${LIMITS_HELP}`,
    );
  }
}

function decodeBase64Url(payload: string): Uint8Array {
  try {
    return base64UrlToBytes(payload);
  } catch (error) {
    throw new Error(
      `Invalid Base64URL payload: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function looksGzipped(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

/**
 * Trusts the bytes over the declared encoding, but refuses to silently accept
 * a payload that claims gzip and is not gzip — that is the truncation case.
 */
function resolveEncoding(bytes: Uint8Array, declared?: PayloadEncoding): PayloadEncoding {
  const gzipped = looksGzipped(bytes);
  if (declared === "gz" && !gzipped) {
    throw new Error(
      "This payload declares enc=gz but does not start with a gzip header — the payload appears truncated or corrupted. Re-copy the full link, or re-encode with enc=raw.",
    );
  }
  if (declared === "raw" && !gzipped) return "raw";
  return gzipped ? "gz" : "raw";
}

async function payloadToJsonBytes(
  payload: string,
  declared?: PayloadEncoding,
): Promise<Uint8Array> {
  if (!payload || typeof payload !== "string") {
    throw new PayloadLimitError(
      "Missing JuanPager page data.",
      "The URL fragment did not include a data payload.",
    );
  }

  assertEncodedSize(payload);

  const bytes = decodeBase64Url(payload);
  const encoding = resolveEncoding(bytes, declared);

  if (encoding === "raw") {
    assertJsonSize(bytes);
    return bytes;
  }

  let jsonBytes: Uint8Array;
  try {
    jsonBytes = await gzipDecompress(bytes);
  } catch (error) {
    throw new Error(
      `Could not decompress this JuanPager payload — it appears truncated or corrupted. Re-copy the full link. (${
        error instanceof Error ? error.message : String(error)
      })`,
    );
  }

  assertJsonSize(jsonBytes);
  return jsonBytes;
}

function parseJson(jsonBytes: Uint8Array): unknown {
  try {
    return JSON.parse(utf8Text(jsonBytes));
  } catch (error) {
    throw new Error(
      `Invalid JSON in payload: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function encodeJson(json: string, encoding: PayloadEncoding): Promise<string> {
  const jsonBytes = utf8Bytes(json);
  assertJsonSize(jsonBytes);

  const bytes = encoding === "raw" ? jsonBytes : await gzipCompress(jsonBytes);
  const encoded = bytesToBase64Url(bytes);
  assertEncodedSize(encoded);
  return encoded;
}

/* ------------------------------- 0.1 path ------------------------------- */

export async function compressDocument(document: JuanPagerDocument): Promise<string> {
  const validated = validateDocument(document);
  return encodeJson(JSON.stringify(toCompactDocument(validated)), "gz");
}

export async function decompressDocument(payload: string): Promise<JuanPagerDocument> {
  const jsonBytes = await payloadToJsonBytes(payload, "gz");
  return validateDocument(fromCompactDocument(parseJson(jsonBytes)));
}

export async function encodeDocumentToFragment(document: JuanPagerDocument): Promise<string> {
  const payload = await compressDocument(document);
  return `#v=1&data=${payload}`;
}

/* ------------------------------- 0.2 path ------------------------------- */

export async function encodeMoment(
  moment: JuanPagerMomentDoc,
  encoding: PayloadEncoding = DEFAULT_ENCODING,
): Promise<string> {
  const validated = validateMoment(moment);
  const json =
    encoding === "raw"
      ? JSON.stringify(validated)
      : JSON.stringify(toCompactMoment(validated));
  return encodeJson(json, encoding);
}

export async function decodeMoment(
  payload: string,
  encoding?: PayloadEncoding,
): Promise<JuanPagerMomentDoc> {
  const jsonBytes = await payloadToJsonBytes(payload, encoding);
  return validateMoment(fromCompactMoment(parseJson(jsonBytes)));
}

export async function encodeMomentToFragment(
  moment: JuanPagerMomentDoc,
  encoding: PayloadEncoding = DEFAULT_ENCODING,
): Promise<string> {
  const payload = await encodeMoment(moment, encoding);
  return `#v=2&enc=${encoding}&data=${payload}`;
}

/* ------------------------------ unified path ----------------------------- */

export type EncodableDocument = JuanPagerDocument | JuanPagerMomentDoc;

function isMomentInput(input: EncodableDocument): input is JuanPagerMomentDoc {
  return (input as JuanPagerMomentDoc).version === "0.2";
}

export async function encodeToFragment(
  input: EncodableDocument,
  options?: { encoding?: PayloadEncoding },
): Promise<string> {
  if (isMomentInput(input)) {
    return encodeMomentToFragment(input, options?.encoding ?? DEFAULT_ENCODING);
  }
  return encodeDocumentToFragment(input);
}

/**
 * Decodes either family. `version`/`encoding` come from the fragment; both are
 * hints — the payload bytes decide how decoding actually happens.
 */
export async function decodePayload(
  payload: string,
  options?: { version?: string; encoding?: PayloadEncoding },
): Promise<LoadedDocument> {
  const declared =
    options?.encoding ?? (options?.version === "1" ? "gz" : undefined);
  const jsonBytes = await payloadToJsonBytes(payload, declared);
  const parsed = parseJson(jsonBytes);

  const record =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  const version = record.version ?? record.v;

  if (version === "0.2" || record.mo !== undefined || record.moment !== undefined) {
    return { kind: "moment", document: validateMoment(fromCompactMoment(parsed)) };
  }

  return validateAnyDocument(fromCompactDocument(parsed));
}

export async function buildShareUrl(
  input: EncodableDocument,
  baseUrl: string,
  options?: { encoding?: PayloadEncoding },
): Promise<string> {
  const fragment = await encodeToFragment(input, options);
  const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalized}${fragment}`;
}

export function measureSizes(encoded: string, decodedJson: string): {
  encodedBytes: number;
  decodedBytes: number;
} {
  return {
    encodedBytes: utf8Bytes(encoded).byteLength,
    decodedBytes: utf8Bytes(decodedJson).byteLength,
  };
}
