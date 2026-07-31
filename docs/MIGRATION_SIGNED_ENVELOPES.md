# Migration: signed M1 envelopes

Raw M1 packets remain valid inputs for local informational rendering. They are not trusted invocation or navigation authority.

## Before

```ts
const page = materializeMeaningPacket(packet);
```

## After: trusted execution path

```ts
import { FileNonceStore, verifyMeaningPacket } from "juanpager/node";
import { signMeaningPacket } from "juanpager";

const envelope = await signMeaningPacket(packet, {
  issuer: "agent:deployment",
  audience: "juanpager:production",
  keyId: "key:2026-01",
  privateKey,
  expiresAt: new Date(Date.now() + 60_000),
});

const verifiedPacket = await verifyMeaningPacket(envelope, {
  audience: "juanpager:production",
  keys: [{
    issuer: "agent:deployment",
    keyId: "key:2026-01",
    publicKey,
    status: "active",
    validFrom: new Date("2026-07-01T00:00:00.000Z"),
    validUntil: new Date("2026-10-01T00:00:00.000Z"),
    capabilities: ["deployment.review"],
  }],
  nonceStore: new FileNonceStore({ path: "/var/lib/juanpager/nonces.json" }),
  requiredCapability: "deployment.review",
});

const page = materializeMeaningPacket(verifiedPacket);
```

## Host changes

1. Provision accepted issuer/key pairs out of band.
2. Mark compromised keys revoked and distribute the updated trusted key set promptly.
3. Configure signing validity windows and explicit direct-key or delegated capabilities.
4. Use a durable atomic nonce store in production. `FileNonceStore` is suitable for one host or a shared atomic filesystem; distributed deployments need a strongly consistent store.
5. Choose a narrow audience per execution boundary.
6. Keep envelope lifetimes short. The verifier defaults to a maximum of five minutes unless policy explicitly widens it.
7. Strip invocation and navigation affordances from unsigned or failed-verification packets while preserving safe local information, inspection, editing, scoping, and selection where appropriate.
8. Sign deltas and receipts when they cross trust boundaries.
9. Persist idempotency keys and receipt lifecycle states independently of nonce replay state.
10. Test key rotation, revocation, storage corruption, restart replay, and restore procedures.

## JuanPage migration

The current canonical path is:

```text
M1
→ trust and capability compiler
→ JuanPage 2.0 semantic graph
→ renderPage adaptive surface
→ typed human deltas and receipts
```

Signed envelopes protect transport. They do not introduce a second UI schema or renderer. Hosts migrating from JuanPage 1.x must separately adopt JuanPage 2.0 affordances, bindings, scopes, selections, and projections.
