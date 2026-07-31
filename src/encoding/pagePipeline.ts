import { base64UrlToBytes, bytesToBase64Url } from "./base64url.js";
import { gzipCompress, gzipDecompress } from "./compress.js";
import { LIMITS, LIMITS_HELP } from "../schema/limits.js";
import { validatePage, type JuanPageDocument } from "../schema/page.js";

export type PagePayloadEncoding = "gz" | "raw";
export const DEFAULT_PAGE_ENCODING: PagePayloadEncoding = "gz";

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

export async function encodePage(
  input: JuanPageDocument,
  encoding: PagePayloadEncoding = DEFAULT_PAGE_ENCODING,
): Promise<string> {
  const page = validatePage(input);
  const jsonBytes = utf8Bytes(JSON.stringify(page));
  assertJsonSize(jsonBytes);
  const payloadBytes = encoding === "gz" ? await gzipCompress(jsonBytes) : jsonBytes;
  const encoded = bytesToBase64Url(payloadBytes);
  assertEncodedSize(encoded);
  return encoded;
}

export async function decodePage(
  payload: string,
  declared?: PagePayloadEncoding,
): Promise<JuanPageDocument> {
  if (!payload) {
    throw new PagePayloadError("Missing JuanPage data.", "The URL did not include a data payload.");
  }
  assertEncodedSize(payload);

  let bytes: Uint8Array;
  try {
    bytes = base64UrlToBytes(payload);
  } catch (error) {
    throw new Error(`Invalid Base64URL payload: ${error instanceof Error ? error.message : String(error)}`);
  }

  const gzipped = looksGzipped(bytes);
  if (declared === "gz" && !gzipped) {
    throw new Error("The link declares gzip but the payload is not gzip. It may be truncated.");
  }

  let jsonBytes = bytes;
  if (gzipped) {
    try {
      jsonBytes = await gzipDecompress(bytes);
    } catch (error) {
      throw new Error(`Could not decompress this JuanPage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  assertJsonSize(jsonBytes);

  let parsed: unknown;
  try {
    parsed = JSON.parse(utf8Text(jsonBytes));
  } catch (error) {
    throw new Error(`Invalid JSON in JuanPage payload: ${error instanceof Error ? error.message : String(error)}`);
  }
  return validatePage(parsed);
}

export async function encodePageToFragment(
  page: JuanPageDocument,
  encoding: PagePayloadEncoding = DEFAULT_PAGE_ENCODING,
): Promise<string> {
  return `#v=3&enc=${encoding}&data=${await encodePage(page, encoding)}`;
}

export async function buildPageShareUrl(
  page: JuanPageDocument,
  baseUrl: string,
  encoding: PagePayloadEncoding = DEFAULT_PAGE_ENCODING,
): Promise<string> {
  const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalized}${await encodePageToFragment(page, encoding)}`;
}

export function measurePageSizes(encoded: string, decoded: string): {
  encodedBytes: number;
  decodedBytes: number;
} {
  return {
    encodedBytes: utf8Bytes(encoded).byteLength,
    decodedBytes: utf8Bytes(decoded).byteLength,
  };
}
