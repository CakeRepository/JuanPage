# Verified agent continuation

JuanPager separates human authorization from remote execution.

```text
signed M1 proposal
→ JuanPage 2.0 through renderPage
→ typed human edits and explicit Complete
→ host-side authorization delta
→ idempotent executor
→ result delta, receipt, and authoritative facts
→ originating agent continues
```

The browser never receives arbitrary executor code and a self-contained URL remains record-only. Remote effects happen only inside a trusted host that chooses an executor and re-checks the session.

## Public entrypoints

```ts
import {
  MemoryAgentHumanSessionStore,
  createAgentHumanSessionHttpHandler,
} from "juanpager/session";
import {
  executeStoredAgentHumanSession,
  type AgentHumanActionExecutor,
} from "juanpager/execution";
import {
  WebhookAgentHumanNotifier,
  notifyAgentHumanSession,
} from "juanpager/notification";
```

## Executor contract

An executor receives a stable mutation ID and idempotency key copied from the original M1 proposal. It returns bounded scalar results, optional evidence IDs, and optional authoritative M1 fact changes.

```ts
const executor: AgentHumanActionExecutor = {
  name: "deployment-control",
  async execute(request) {
    const deployment = await deployOnce({
      idempotencyKey: request.idempotencyKey,
      target: request.target,
      arguments: request.arguments,
    });

    return {
      status: "succeeded",
      result: { deploymentId: deployment.id },
      facts: [{
        kind: "set",
        target: "e:release",
        property: "prop:approved",
        value: true,
      }],
      evidence: [`evidence:${deployment.id}`],
    };
  },
};

const continuation = await executeStoredAgentHumanSession({
  sessionId,
  store,
  executor,
});
```

By default execution waits until the human marks the durable session `completed`. A completed approval proposal becomes an explicit M1 `ApproveAction` mutation before execution. The host then appends `executing` and terminal `succeeded` or `failed` receipts plus an `ActionResult` or `ActionFailed` delta.

Calling continuation again does not execute the same mutation again after a terminal result is present. External systems must also enforce the supplied idempotency key at their own side-effect boundary.

## Durable session HTTP service

`createAgentHumanSessionHttpHandler` is a Fetch-standard handler that can be mounted in Node, Deno, Bun, Workers, serverless functions, or any framework that adapts `Request` and `Response`.

```ts
const handleSession = createAgentHumanSessionHttpHandler({
  store,
  allowedOrigins: ["https://app.example"],
  authorize: async (request) => {
    const identity = await verifyBearerToken(request.headers.get("authorization"));
    return identity && {
      subject: identity.subject,
      tenantId: identity.tenantId,
    };
  },
});
```

The handler provides:

- authenticated session access;
- tenant isolation independent of session ID secrecy;
- `ETag`, `If-Match`, and exact one-revision updates;
- immutable creation timestamps;
- fail-closed lifecycle transitions;
- expiration checks;
- request-size limits;
- optional CORS allowlisting;
- conflict responses with the current revision.

The host remains responsible for selecting a durable database, encryption, backups, retention, rate limits, audit export, identity verification, and regional consistency.

## Notification handoff

Notifications contain only a title, body, urgency, expiry, and the durable JuanPager launch URL. They do not contain executor authority or credentials.

```ts
const notifier = new WebhookAgentHumanNotifier({
  endpoint: "https://notifications.example/juanpager",
  headers: { authorization: `Bearer ${token}` },
});

await notifyAgentHumanSession({
  session,
  appBaseUrl: "https://app.example/juanpager/",
  notifier,
  urgency: "high",
});
```

`BrowserAgentHumanNotifier` uses the installed PWA service worker when available. The service worker validates notification launch URLs as same-origin and within its scope, then focuses or opens the durable session.

A webhook host can bridge the same data-only contract to Web Push, APNs, FCM, email, Teams, Slack, SMS, or another reviewed delivery channel.

## Required host checks

Before executing any remote effect, a production host should:

1. verify the original signed M1 packet and required capability;
2. authenticate the session principal and enforce tenant ownership;
3. require explicit human completion for approval-gated work;
4. validate the action, target, arguments, mutation ID, and idempotency key;
5. enforce operation-specific authorization again at execution time;
6. make the external side effect idempotent;
7. append a terminal result delta and receipt;
8. preserve evidence and audit identifiers without logging secrets;
9. reject stale session revisions rather than merging authority implicitly;
10. treat notifications and session IDs as routing, never authentication.

## What this does not change

JuanPage 2.0 remains the only public UI schema. `renderPage` remains the only renderer. M1 remains semantic transport. Execution, storage, and notification are host services around the same typed session; they do not introduce a second UI format or permit agents to send components or code.
