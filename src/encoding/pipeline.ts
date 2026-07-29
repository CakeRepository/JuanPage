import { validateDocument, type JuanPagerDocument } from "../schema/document.js";
import { LIMITS, LIMITS_HELP } from "../schema/limits.js";
import { base64UrlToBytes, bytesToBase64Url } from "./base64url.js";
import { fromCompactDocument, toCompactDocument } from "./compact.js";
import { gzipCompress, gzipDecompress } from "./compress.js";

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

export async function compressDocument(document: JuanPagerDocument): Promise<string> {
  const validated = validateDocument(document);
  const compact = toCompactDocument(validated);
  const json = JSON.stringify(compact);
  const jsonBytes = utf8Bytes(json);

  if (jsonBytes.byteLength > LIMITS.maxDecodedJsonBytes) {
    throw new PayloadLimitError(
      "This JuanPager document exceeds size limits.",
      `Decoded JSON is ${jsonBytes.byteLength} bytes; maximum is ${LIMITS.maxDecodedJsonBytes}.\n${LIMITS_HELP}`,
    );
  }

  const compressed = await gzipCompress(jsonBytes);
  const encoded = bytesToBase64Url(compressed);

  if (utf8Bytes(encoded).byteLength > LIMITS.maxEncodedFragmentBytes) {
    throw new PayloadLimitError(
      "This JuanPager document exceeds size limits.",
      `Encoded fragment is ${utf8Bytes(encoded).byteLength} bytes; maximum is ${LIMITS.maxEncodedFragmentBytes}.\n${LIMITS_HELP}`,
    );
  }

  return encoded;
}

export async function decompressDocument(payload: string): Promise<JuanPagerDocument> {
  if (!payload || typeof payload !== "string") {
    throw new PayloadLimitError(
      "Missing JuanPager page data.",
      "The URL fragment did not include a data payload.",
    );
  }

  if (utf8Bytes(payload).byteLength > LIMITS.maxEncodedFragmentBytes) {
    throw new PayloadLimitError(
      "This JuanPager document exceeds size limits.",
      `Encoded fragment is ${utf8Bytes(payload).byteLength} bytes; maximum is ${LIMITS.maxEncodedFragmentBytes}.\n${LIMITS_HELP}`,
    );
  }

  let compressed: Uint8Array;
  try {
    compressed = base64UrlToBytes(payload);
  } catch (error) {
    throw new Error(
      `Invalid Base64URL payload: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  let jsonBytes: Uint8Array;
  try {
    jsonBytes = await gzipDecompress(compressed);
  } catch (error) {
    throw new Error(
      `Invalid compressed payload: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (jsonBytes.byteLength > LIMITS.maxDecodedJsonBytes) {
    throw new PayloadLimitError(
      "This JuanPager document exceeds size limits.",
      `Decoded JSON is ${jsonBytes.byteLength} bytes; maximum is ${LIMITS.maxDecodedJsonBytes}.\n${LIMITS_HELP}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(utf8Text(jsonBytes));
  } catch (error) {
    throw new Error(
      `Invalid JSON after decompression: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const expanded = fromCompactDocument(parsed);
  return validateDocument(expanded);
}

export async function encodeDocumentToFragment(document: JuanPagerDocument): Promise<string> {
  const payload = await compressDocument(document);
  return `#v=1&data=${payload}`;
}

export async function buildShareUrl(
  document: JuanPagerDocument,
  baseUrl: string,
): Promise<string> {
  const fragment = await encodeDocumentToFragment(document);
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
