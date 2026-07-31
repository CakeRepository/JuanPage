import { describe, expect, it } from "vitest";
import { futureMeaningPacket } from "../src/examples/meaning-workspace.js";
import {
  MemoryNonceStore,
  generateEd25519KeyPair,
  signMeaningPacket,
  verifyMeaningPacket,
  type VerificationKey,
} from "../src/protocol/envelope.js";

async function fixture(lifetimeMs = 60_000) {
  const keys = await generateEd25519KeyPair();
  const now = new Date("2026-07-31T21:00:00.000Z");
  const envelope = await signMeaningPacket(futureMeaningPacket, {
    issuer: "test:issuer",
    audience: "test:audience",
    keyId: "key:test",
    privateKey: keys.privateKey,
    issuedAt: now,
    expiresAt: new Date(now.getTime() + lifetimeMs),
    nonce: `nonce:${lifetimeMs}`,
  });
  const key: VerificationKey = {
    issuer: "test:issuer",
    keyId: "key:test",
    publicKey: keys.publicKey,
  };
  return { now, envelope, key };
}

function options(now: Date, key: VerificationKey) {
  return {
    audience: "test:audience",
    keys: [key],
    nonceStore: new MemoryNonceStore(() => now),
    now,
    clockSkewMs: 0,
  };
}

describe("verification key lifecycle policy", () => {
  it("rejects revoked and out-of-window keys", async () => {
    const { now, envelope, key } = await fixture();
    await expect(verifyMeaningPacket(envelope, options(now, { ...key, status: "revoked" }))).rejects.toMatchObject({ code: "revoked_key" });
    await expect(verifyMeaningPacket(envelope, options(now, { ...key, validFrom: new Date(now.getTime() + 1) }))).rejects.toMatchObject({ code: "key_not_yet_valid" });
    await expect(verifyMeaningPacket(envelope, options(now, { ...key, validUntil: now }))).rejects.toMatchObject({ code: "key_expired" });
  });

  it("requires an explicitly granted direct-key capability", async () => {
    const { now, envelope, key } = await fixture();
    await expect(verifyMeaningPacket(envelope, {
      ...options(now, key),
      requiredCapability: "records.read",
    })).rejects.toMatchObject({ code: "missing_capability" });

    await expect(verifyMeaningPacket(envelope, {
      ...options(now, { ...key, capabilities: ["records.read"] }),
      requiredCapability: "records.read",
    })).resolves.toEqual(futureMeaningPacket);
  });

  it("bounds envelope lifetime unless policy explicitly widens it", async () => {
    const { now, envelope, key } = await fixture(10 * 60_000);
    await expect(verifyMeaningPacket(envelope, options(now, key))).rejects.toMatchObject({ code: "lifetime_too_long" });
    await expect(verifyMeaningPacket(envelope, {
      ...options(now, key),
      maxEnvelopeLifetimeMs: 11 * 60_000,
    })).resolves.toEqual(futureMeaningPacket);
  });
});
