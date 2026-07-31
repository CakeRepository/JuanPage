import type { ActionReceipt, MeaningDelta, MeaningPacket } from "./meaning.js";

export type SignedPayloadType = "meaning-packet" | "meaning-delta" | "action-receipt";
export type SignatureAlgorithm = "Ed25519";

export type Delegation = Readonly<{
  issuer: string;
  subject: string;
  audience: string;
  capabilities: readonly string[];
  issuedAt: string;
  expiresAt: string;
  keyId: string;
  algorithm: SignatureAlgorithm;
  signature: string;
}>;

export type SignedEnvelope<T> = Readonly<{
  protocolVersion: "1.0";
  payloadType: SignedPayloadType;
  issuer: string;
  audience: string;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  keyId: string;
  algorithm: SignatureAlgorithm;
  payloadDigest: string;
  payload: T;
  delegation?: readonly Delegation[];
  signature: string;
}>;

export type SigningIdentity = Readonly<{
  issuer: string;
  audience: string;
  keyId: string;
  privateKey: CryptoKey;
  issuedAt?: Date;
  expiresAt: Date;
  nonce?: string;
  delegation?: readonly Delegation[];
}>;

export type VerificationKey = Readonly<{
  issuer: string;
  keyId: string;
  publicKey: CryptoKey;
}>;

export interface NonceStore {
  consume(issuer: string, nonce: string, expiresAt: Date): boolean | Promise<boolean>;
}

export type VerificationOptions = Readonly<{
  audience: string;
  keys: readonly VerificationKey[];
  nonceStore: NonceStore;
  now?: Date;
  clockSkewMs?: number;
  requiredCapability?: string;
}>;

export class EnvelopeVerificationError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "EnvelopeVerificationError";
  }
}

export class MemoryNonceStore implements NonceStore {
  private readonly seen = new Map<string, number>();

  consume(issuer: string, nonce: string, expiresAt: Date): boolean {
    const key = `${issuer}\u0000${nonce}`;
    if (this.seen.has(key)) return false;
    this.seen.set(key, expiresAt.getTime());
    return true;
  }
}

const encoder = new TextEncoder();
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
const base64UrlPattern = /^[A-Za-z0-9_-]+$/;

function cryptoApi(): Crypto {
  if (!globalThis.crypto?.subtle) throw new EnvelopeVerificationError("crypto_unavailable", "Web Crypto is required.");
  return globalThis.crypto;
}

function encodeBase64Url(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64url");
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function decodeBase64Url(value: string): Uint8Array {
  if (!base64UrlPattern.test(value)) throw new EnvelopeVerificationError("malformed_signature", "Expected base64url data.");
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(value, "base64url"));
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new EnvelopeVerificationError("non_canonical_payload", "Payload numbers must be finite.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
  }
  throw new EnvelopeVerificationError("non_canonical_payload", "Payload contains an unsupported value.");
}

async function digest(payload: unknown): Promise<string> {
  const bytes = await cryptoApi().subtle.digest("SHA-256", encoder.encode(canonicalize(payload)));
  return `sha-256:${encodeBase64Url(new Uint8Array(bytes))}`;
}

function unsignedEnvelope<T>(envelope: Omit<SignedEnvelope<T>, "signature">): string {
  return canonicalize(envelope);
}

function parseTimestamp(value: unknown, field: string): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)) {
    throw new EnvelopeVerificationError("malformed_timestamp", `${field} must be an RFC 3339 UTC timestamp.`);
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new EnvelopeVerificationError("malformed_timestamp", `${field} is invalid.`);
  return date;
}

function assertEnvelopeShape<T>(input: SignedEnvelope<T>): void {
  if (input.protocolVersion !== "1.0") throw new EnvelopeVerificationError("unsupported_version", "Unsupported envelope protocol version.");
  if (input.algorithm !== "Ed25519") throw new EnvelopeVerificationError("unsupported_algorithm", "Only Ed25519 is supported.");
  for (const [field, value] of [["issuer", input.issuer], ["audience", input.audience], ["nonce", input.nonce], ["keyId", input.keyId]] as const) {
    if (!idPattern.test(value)) throw new EnvelopeVerificationError("malformed_envelope", `${field} is malformed.`);
  }
  if (!input.payloadDigest.startsWith("sha-256:")) throw new EnvelopeVerificationError("malformed_digest", "Unsupported payload digest.");
}

async function signPayload<T>(payloadType: SignedPayloadType, payload: T, identity: SigningIdentity): Promise<SignedEnvelope<T>> {
  const issuedAt = identity.issuedAt ?? new Date();
  if (identity.expiresAt.getTime() <= issuedAt.getTime()) throw new EnvelopeVerificationError("invalid_lifetime", "Expiration must follow issuance.");
  const envelope: Omit<SignedEnvelope<T>, "signature"> = {
    protocolVersion: "1.0",
    payloadType,
    issuer: identity.issuer,
    audience: identity.audience,
    issuedAt: issuedAt.toISOString(),
    expiresAt: identity.expiresAt.toISOString(),
    nonce: identity.nonce ?? cryptoApi().randomUUID(),
    keyId: identity.keyId,
    algorithm: "Ed25519",
    payloadDigest: await digest(payload),
    payload,
    ...(identity.delegation ? { delegation: identity.delegation } : {}),
  };
  const signature = await cryptoApi().subtle.sign("Ed25519", identity.privateKey, encoder.encode(unsignedEnvelope(envelope)));
  return { ...envelope, signature: encodeBase64Url(new Uint8Array(signature)) };
}

async function verifyDelegation(chain: readonly Delegation[] | undefined, envelope: SignedEnvelope<unknown>, options: VerificationOptions): Promise<void> {
  if (!chain?.length) return;
  let expectedIssuer = envelope.issuer;
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const delegation = chain[index];
    if (!delegation || delegation.subject !== expectedIssuer || delegation.audience !== envelope.audience) {
      throw new EnvelopeVerificationError("invalid_delegation", "Delegation subject or audience does not match.");
    }
    const issuedAt = parseTimestamp(delegation.issuedAt, "delegation.issuedAt");
    const expiresAt = parseTimestamp(delegation.expiresAt, "delegation.expiresAt");
    const now = options.now ?? new Date();
    if (issuedAt > now || expiresAt <= now) throw new EnvelopeVerificationError("invalid_delegation", "Delegation is outside its validity window.");
    if (options.requiredCapability && !delegation.capabilities.includes(options.requiredCapability)) {
      throw new EnvelopeVerificationError("invalid_delegation", "Delegation does not grant the required capability.");
    }
    const key = options.keys.find((candidate) => candidate.issuer === delegation.issuer && candidate.keyId === delegation.keyId);
    if (!key) throw new EnvelopeVerificationError("unknown_key", "Delegation signing key is unknown.");
    const { signature, ...body } = delegation;
    const valid = await cryptoApi().subtle.verify("Ed25519", key.publicKey, decodeBase64Url(signature) as BufferSource, encoder.encode(canonicalize(body)));
    if (!valid) throw new EnvelopeVerificationError("invalid_delegation", "Delegation signature is invalid.");
    expectedIssuer = delegation.issuer;
  }
}

async function verifyPayload<T>(input: SignedEnvelope<T>, payloadType: SignedPayloadType, options: VerificationOptions): Promise<T> {
  assertEnvelopeShape(input);
  if (input.payloadType !== payloadType) throw new EnvelopeVerificationError("wrong_payload_type", "Envelope payload type does not match.");
  if (input.audience !== options.audience) throw new EnvelopeVerificationError("wrong_audience", "Envelope audience does not match.");
  const issuedAt = parseTimestamp(input.issuedAt, "issuedAt");
  const expiresAt = parseTimestamp(input.expiresAt, "expiresAt");
  const now = options.now ?? new Date();
  const skew = options.clockSkewMs ?? 30_000;
  if (issuedAt.getTime() > now.getTime() + skew) throw new EnvelopeVerificationError("not_yet_valid", "Envelope issuance is in the future.");
  if (expiresAt.getTime() <= now.getTime() - skew) throw new EnvelopeVerificationError("expired", "Envelope has expired.");
  if (expiresAt <= issuedAt) throw new EnvelopeVerificationError("malformed_timestamp", "Envelope lifetime is invalid.");
  if (await digest(input.payload) !== input.payloadDigest) throw new EnvelopeVerificationError("digest_mismatch", "Payload digest does not match.");
  const key = options.keys.find((candidate) => candidate.issuer === input.issuer && candidate.keyId === input.keyId);
  if (!key) throw new EnvelopeVerificationError("unknown_key", "Envelope signing key is unknown.");
  const { signature, ...body } = input;
  const valid = await cryptoApi().subtle.verify("Ed25519", key.publicKey, decodeBase64Url(signature) as BufferSource, encoder.encode(unsignedEnvelope(body)));
  if (!valid) throw new EnvelopeVerificationError("invalid_signature", "Envelope signature is invalid.");
  await verifyDelegation(input.delegation, input, options);
  if (!(await options.nonceStore.consume(input.issuer, input.nonce, expiresAt))) throw new EnvelopeVerificationError("replayed_nonce", "Envelope nonce has already been consumed.");
  return input.payload;
}

export const signMeaningPacket = (payload: MeaningPacket, identity: SigningIdentity): Promise<SignedEnvelope<MeaningPacket>> => signPayload("meaning-packet", payload, identity);
export const signMeaningDelta = (payload: MeaningDelta, identity: SigningIdentity): Promise<SignedEnvelope<MeaningDelta>> => signPayload("meaning-delta", payload, identity);
export const signActionReceipt = (payload: ActionReceipt, identity: SigningIdentity): Promise<SignedEnvelope<ActionReceipt>> => signPayload("action-receipt", payload, identity);
export const verifyMeaningPacket = (envelope: SignedEnvelope<MeaningPacket>, options: VerificationOptions): Promise<MeaningPacket> => verifyPayload(envelope, "meaning-packet", options);
export const verifyMeaningDelta = (envelope: SignedEnvelope<MeaningDelta>, options: VerificationOptions): Promise<MeaningDelta> => verifyPayload(envelope, "meaning-delta", options);
export const verifyActionReceipt = (envelope: SignedEnvelope<ActionReceipt>, options: VerificationOptions): Promise<ActionReceipt> => verifyPayload(envelope, "action-receipt", options);

export async function generateEd25519KeyPair(): Promise<CryptoKeyPair> {
  return cryptoApi().subtle.generateKey("Ed25519", true, ["sign", "verify"]);
}
