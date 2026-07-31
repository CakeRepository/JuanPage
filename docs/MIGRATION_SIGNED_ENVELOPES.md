# Migration: signed M1 envelopes

Existing raw M1 packets remain valid inputs for local, informational rendering. They are not trusted execution authority.

## Before

```ts
const page = materializeMeaningPacket(packet);
```

## After: trusted execution path

```ts
const envelope = await signMeaningPacket(packet, {
  issuer: "agent:deployment",
  audience: "juanpager:production",
  keyId: "key:2026-01",
  privateKey,
  expiresAt: new Date(Date.now() + 60_000),
});

const verifiedPacket = await verifyMeaningPacket(envelope, {
  audience: "juanpager:production",
  keys: [{ issuer: "agent:deployment", keyId: "key:2026-01", publicKey }],
  nonceStore,
});

const page = materializeMeaningPacket(verifiedPacket);
```

## Host changes

1. Provision accepted issuer/key pairs out of band.
2. Use a durable atomic nonce store in production.
3. Choose a narrow audience per execution boundary.
4. Enforce short envelope lifetimes and controlled clock skew.
5. Strip executable actions from unsigned or failed-verification packets while preserving safe informational rendering where appropriate.
6. Sign deltas and receipts when they cross trust boundaries.
7. Persist idempotency keys and receipt lifecycle states.

No JuanPage schema or renderer migration is required. The architecture remains `M1 → JuanPage 1.0 → renderPage`.
