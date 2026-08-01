# Security policy

## Supported versions

Security fixes are provided for the latest release on the current supported line. Before the first npm publication, `main` is the only supported development line.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub private vulnerability reporting for this repository. Include the affected commit or version, a minimal reproduction, impact, and any suggested mitigation. Maintainers will acknowledge a complete report within five business days and will coordinate disclosure after a fix is available.

## Trust guarantees

A successfully verified signed M1 envelope guarantees, within the limits below, that:

- the canonical payload bytes match the signed SHA-256 digest;
- the Ed25519 signature verifies under the selected issuer and key ID;
- the verification key is active and the signature timestamp falls inside its configured validity window;
- a requested direct-key capability is explicitly granted, or every delegation grants it;
- the audience matches the verifier's configured audience;
- issuance and expiration timestamps are valid under the configured clock skew;
- envelope lifetime does not exceed verifier policy; the default maximum is five minutes;
- the nonce was accepted exactly once by the supplied nonce store;
- every supplied delegation is signed, unexpired, audience-bound, and capability-constrained;
- executable operations still pass M1 permission and capability enforcement before reaching `renderPage`.

Unsigned packets may be materialized for informational display. Their invocation and navigation affordances are not trusted execution authority and hosts must strip them.

A durable `AgentHumanSession` does not independently grant execution authority. It stores a validated JuanPage, optional verified M1 session, typed human state, lifecycle status, source routing, and revision. Hosts must preserve the original trust decision and re-check any capability required by external execution.

## Data-only runtime boundary

JuanPager never executes agent-authored HTML, CSS, JavaScript, WebAssembly, callbacks, iframes, arbitrary components, plugins, or network instructions. JuanPage, M1, interaction state, sessions, deltas, receipts, execution requests, and notifications remain bounded data validated before rendering, replay, or delivery.

The installed PWA is the same trusted runtime as the website. Installation does not expand packet authority. The service worker caches same-origin application-shell resources and navigation responses; URL fragments are not HTTP request data and are not used as cache keys. Offline interaction remains local until an explicit synchronization succeeds.

## Replay protection

`MemoryNonceStore` is intended for tests and single-process demonstrations. It does not survive a restart unless the host supplies its own persistence.

`FileNonceStore`, exported from `juanpager/node`, provides atomic persistent replay protection for one host or processes sharing a filesystem. It serializes access with an atomic lock directory, fails closed on corrupt state, prunes expired entries, and atomically replaces persisted state.

A shared filesystem is not a multi-region consensus system. Distributed deployments should implement the `NonceStore` interface using a transactional database or strongly consistent key-value store with an atomic insert-if-absent operation and expiration.

## Durable session storage

`MemoryAgentHumanSessionStore` is process-local and intended for tests or demonstrations.

`BrowserAgentHumanSessionStore` uses origin-scoped browser storage. It provides offline continuity, not confidentiality against a user, browser extension, compromised origin, or device administrator. Do not store secrets in browser-local sessions. Production deployments should define retention and provide a visible way to remove local session data.

`HttpAgentHumanSessionStore` requires HTTPS outside local development and sends an explicit previous revision with writes. The service must:

- authenticate the human and originating agent or service;
- authorize access to each session rather than relying on session ID secrecy;
- reject stale writes with HTTP 409 or 412;
- apply encryption at rest when required by the data classification;
- enforce expiry, retention, deletion, and audit policy;
- prevent one tenant from reading or mutating another tenant's sessions;
- validate the returned session before storage and again when loaded;
- avoid exposing bearer credentials in the JuanPage, URL fragment, manifest, service worker, or local storage.

`createAgentHumanSessionHttpHandler` supplies a reference Fetch-standard boundary with required authentication, tenant metadata enforcement, exact one-revision updates, `If-Match`, immutable creation time, bounded request bodies, expiration checks, and fail-closed lifecycle transitions. It does not provide an identity provider, database, encryption key management, backups, rate limiting, malware inspection, regional consensus, or audit retention. Production hosts must supply those controls.

Session IDs are routing identifiers, not credentials. Use high-entropy IDs and independent authentication.

## Verified external execution

The browser and self-contained URL transport remain record-only. Remote effects occur only through a host-selected `AgentHumanActionExecutor`.

`executeStoredAgentHumanSession` requires explicit durable-session completion by default. For an approval-gated proposal, it appends an M1 `ApproveAction` mutation before invoking the executor, preserves the proposal's mutation ID and idempotency key, records `executing`, and writes a terminal result delta and receipt.

This sequencing prevents accidental duplicate execution inside one valid session history, but it cannot make an external system idempotent. Every executor must enforce the supplied idempotency key at the actual side-effect boundary. The host must also re-check operation-specific authorization, target, arguments, tenant, capability, and current external state immediately before execution.

Executor output is not automatically trusted merely because it satisfies the TypeScript interface. A compromised or dishonest executor can return false results or evidence. Hosts should bind evidence to external audit records, independently verify high-impact outcomes, and sign terminal receipts when non-repudiation is required.

Never allow a page, URL, notification, model response, label, or session completion flag to select arbitrary code, a network destination, shell command, SQL statement, or plugin. Map known semantic operation IDs to reviewed executor implementations in trusted host configuration.

## Notification delivery

Notifications are routing messages, not authorization. The JuanPager notification contract contains a title, body, urgency, expiry, session ID, and launch URL. Do not include access tokens, secrets, raw sensitive evidence, or executor credentials.

`BrowserAgentHumanNotifier` uses browser permission and the installed service worker. Notification clicks are accepted only for same-origin URLs within the service-worker scope. `WebhookAgentHumanNotifier` requires HTTPS outside localhost, but the destination remains a trusted deployment choice. Hosts must authenticate the webhook, validate downstream providers, rate-limit abuse, prevent open redirects, and follow data-retention requirements for email, SMS, push, chat, or other delivery channels.

A notification recipient must still authenticate to load the durable session. Possession of the notification or launch URL must not grant session access.

## Key lifecycle

A verification key may declare:

- `status: "active" | "revoked"`;
- `validFrom` and `validUntil` signing windows;
- explicit capability grants.

Revoked keys fail closed. A signature created before `validFrom` or at/after `validUntil` is rejected. Key provisioning, secure private-key storage, issuer identity proofing, rotation scheduling, and distribution of the trusted verification-key set remain deployment responsibilities.

## Limitations

Signatures provide integrity and configured-key authenticity, not confidentiality, identity discovery, online revocation discovery, or proof that an external executor acted honestly. M1 payloads remain visible to every transport intermediary that can read them. Do not place secrets in packets or URL fragments.

URL fragments can appear in browser history, screenshots, bookmarks, extensions, crash reports, copied messages, and support recordings. Use authenticated durable sessions for sensitive, long-lived, large, or multi-device workflows.

Delegation verifies an explicit signed chain; it does not perform certificate discovery or policy federation. A verifier must provide every trusted key and select the required capability.

JuanPager never treats labels, localized vocabulary, embeddings, latent vectors, display metadata, UI structure, session IDs, notifications, or completion status as authorization data.

A receipt is evidence that must be checked against the expected operation, actor, target, policy, idempotency key, and executor. It is not proof that an external system behaved honestly.

## Secure integration requirements

Production hosts should:

1. use a durable atomic nonce store appropriate to their consistency boundary;
2. keep private keys outside application bundles and source control;
3. rotate verification keys with explicit validity windows and revoke compromised keys immediately;
4. pin accepted audiences and required capabilities;
5. retain the default short envelope lifetime unless a reviewed workflow requires otherwise;
6. reject unknown algorithms, issuers, keys, versions, and partially migrated inputs;
7. log packet IDs, session IDs, revisions, receipt IDs, mutation IDs, actors, executors, and idempotency keys without logging secrets;
8. require HTTPS outside local development;
9. authenticate and authorize every durable-session read and write;
10. enforce tenant isolation, exact optimistic session revisions, and fail on conflicts rather than overwriting;
11. test backup, restore, corruption, replay, session expiry, offline recovery, and key-compromise procedures;
12. map semantic operation IDs only to reviewed host executors and re-authorize immediately before effects;
13. enforce idempotency in the external system, not only in JuanPager session history;
14. treat external execution receipts as evidence to verify, not as unquestionable truth;
15. require authentication after every notification handoff and never place credentials in notification payloads;
16. review service-worker cache and notification scope and invalidate the shell during security releases;
17. keep CSP restrictive and explicitly allow only required same-origin or reviewed session and notification endpoints.
