import { describe, expect, it } from "vitest";
import { futureMeaningPacket } from "../src/examples/meaning-workspace.js";
import {
  EnvelopeVerificationError,
  MemoryNonceStore,
  generateEd25519KeyPair,
  signMeaningPacket,
  verifyMeaningPacket,
  type SignedEnvelope,
} from "../src/protocol/envelope.js";

async function fixture() {
  const keys = await generateEd25519KeyPair();
  const now = new Date("2026-07-31T21:00:00.000Z");
  const envelope = await signMeaningPacket(futureMeaningPacket, {
    issuer: "agent:deployment",
    audience: "juanpager:reference",
    keyId: "key:2026-01",
    privateKey: keys.privateKey,
    issuedAt: now,
    expiresAt: new Date(now.getTime() + 60_000),
    nonce: "nonce:reference:1",
  });
  return { keys, now, envelope };
}

function options(keys: CryptoKeyPair, now: Date, nonceStore = new MemoryNonceStore()) {
  return {
    audience: "juanpager:reference",
    keys: [{ issuer: "agent:deployment", keyId: "key:2026-01", publicKey: keys.publicKey }],
    nonceStore,
    now,
    clockSkewMs: 0,
  };
}

describe("signed M1 envelopes", () => {
  it("verifies an authentic packet and rejects nonce replay", async () => {
    const { keys, now, envelope } = await fixture();
    const nonceStore = new MemoryNonceStore();
    await expect(verifyMeaningPacket(envelope, options(keys, now, nonceStore))).resolves.toEqual(futureMeaningPacket);
    await expect(verifyMeaningPacket(envelope, options(keys, now, nonceStore))).rejects.toMatchObject({ code: "replayed_nonce" });
  });

  it("rejects altered payloads", async () => {
    const { keys, now, envelope } = await fixture();
    const altered = { ...envelope, payload: [...envelope.payload.slice(0, 2), 999, ...envelope.payload.slice(3)] } as unknown as SignedEnvelope<typeof futureMeaningPacket>;
    await expect(verifyMeaningPacket(altered, options(keys, now))).rejects.toMatchObject({ code: "digest_mismatch" });
  });

  it("rejects expiration, wrong audience, unknown keys, and unsupported algorithms", async () => {
    const { keys, now, envelope } = await fixture();
    await expect(verifyMeaningPacket(envelope, { ...options(keys, new Date(now.getTime() + 120_000)) })).rejects.toMatchObject({ code: "expired" });
    await expect(verifyMeaningPacket(envelope, { ...options(keys, now), audience: "other" })).rejects.toMatchObject({ code: "wrong_audience" });
    await expect(verifyMeaningPacket(envelope, { ...options(keys, now), keys: [] })).rejects.toMatchObject({ code: "unknown_key" });
    const unsupported = { ...envelope, algorithm: "ES256" } as unknown as typeof envelope;
    await expect(verifyMeaningPacket(unsupported, options(keys, now))).rejects.toBeInstanceOf(EnvelopeVerificationError);
  });

  it("rejects malformed timestamps before signature acceptance", async () => {
    const { keys, now, envelope } = await fixture();
    const malformed = { ...envelope, issuedAt: "tomorrow" };
    await expect(verifyMeaningPacket(malformed, options(keys, now))).rejects.toMatchObject({ code: "malformed_timestamp" });
  });
});
