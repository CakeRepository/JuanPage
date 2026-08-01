import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const root = process.cwd();
const consumerDirectory = await mkdtemp(join(tmpdir(), "juanpager-consumer-"));
let tarballPath: string | undefined;

const consumerSource = `
import { join } from "node:path";
import {
  MemoryNonceStore,
  advanceAgentHumanSession,
  appendMeaningSessionDelta,
  createActionDelta,
  createActionReceipt,
  createAgentHumanSession,
  createMeaningSession,
  createScopeDelta,
  generateEd25519KeyPair,
  materializeMeaningPacket,
  signMeaningPacket,
  validatePage,
  verifyMeaningPacket,
} from "juanpager";
import { FileNonceStore } from "juanpager/node";
import { MemoryAgentHumanSessionStore } from "juanpager/session";
import { executeStoredAgentHumanSession } from "juanpager/execution";
import { notificationForAgentHumanSession } from "juanpager/notification";

const page = validatePage({
  version: "2.0",
  title: "Independent consumer",
  objects: [{
    id: "financial:july",
    type: "financial",
    name: "July financials",
    fields: [
      { key: "period", value: "2026-07" },
      { key: "revenue", value: 213000, format: "currency", currency: "USD" },
    ],
  }],
  scopes: [{ id: "period", label: "Period", field: "period", initial: "2026-07" }],
  affordances: [{
    id: "scope-period",
    label: "Period",
    effect: { kind: "scope", scope: "period" },
    input: { kind: "choice", options: [
      { label: "June", value: "2026-06" },
      { label: "July", value: "2026-07" },
    ] },
  }],
  bindings: [{ id: "scope-control", target: { kind: "page" }, affordance: "scope-period" }],
});
if (page.version !== "2.0") throw new Error("JuanPage public validator failed.");

const delta = createScopeDelta("pkt:consumer", 0, "period", "2026-07");
if (delta[4][0]?.[0] !== 22) throw new Error("Scope delta public API failed.");

const packet = [
  1,
  "pkt:consumer",
  0,
  null,
  [],
  [
    [0, [1, "Consumer packet"], [1, "Verify package interoperability"], null, 0, 0, 0, 0],
    [1, "entity:consumer", "type:consumer", [1, "Consumer"], null, null, 0, null, [], []],
  ],
];
const keys = await generateEd25519KeyPair();
const now = new Date();
const envelope = await signMeaningPacket(packet, {
  issuer: "consumer:test",
  audience: "consumer:runtime",
  keyId: "key:1",
  privateKey: keys.privateKey,
  issuedAt: now,
  expiresAt: new Date(now.getTime() + 60_000),
  nonce: "nonce:consumer:1",
});
const verified = await verifyMeaningPacket(envelope, {
  audience: "consumer:runtime",
  keys: [{ issuer: "consumer:test", keyId: "key:1", publicKey: keys.publicKey }],
  nonceStore: new MemoryNonceStore(),
  now,
  clockSkewMs: 0,
});
if (verified[1] !== "pkt:consumer") throw new Error("Envelope public API failed.");

const fileStorePath = join(process.cwd(), "nonce-state.json");
const firstStore = new FileNonceStore({ path: fileStorePath });
const secondStore = new FileNonceStore({ path: fileStorePath });
if (!(await firstStore.consume("consumer:test", "nonce:persistent", new Date(Date.now() + 60_000)))) {
  throw new Error("FileNonceStore rejected a new nonce.");
}
if (await secondStore.consume("consumer:test", "nonce:persistent", new Date(Date.now() + 60_000))) {
  throw new Error("FileNonceStore allowed replay after restart.");
}

const loopPacket = [
  1,
  "pkt:consumer:loop",
  0,
  null,
  [],
  [
    [0, [1, "External agent handoff"], [1, "Approve a change and continue the agent"], null, 0, 0, 0, 0],
    [1, "entity:change", "type:change", [1, "Production change"], null, null, 1, null, ["action:approve"], []],
    [2, "entity:change", "prop:approved", false, [1, "Approved"], 0, 1, null],
    [4, "action:approve", 0, [1, "Approve"], "entity:change", "prop:approved", false, 2, null, "operation:approve"],
    [8, "action:approve", 2, [1, "Human approval is required"]],
  ],
];
let loopMeaning = createMeaningSession(loopPacket);
const proposal = createActionDelta(
  "pkt:consumer:loop",
  0,
  "actor:human:external",
  "action:approve",
  "entity:change",
  { source: "clean-room-consumer" },
  "approval",
  {
    mutationId: "mutation:consumer:approve",
    idempotencyKey: "idempotency:consumer:approve",
  },
);
loopMeaning = appendMeaningSessionDelta(
  loopMeaning,
  proposal,
  createActionReceipt(proposal, "proposed", { execution: "record-only" }),
);
let loopSession = createAgentHumanSession({
  id: "session:consumer:loop",
  document: materializeMeaningPacket(loopPacket),
  meaning: loopMeaning,
  source: { kind: "agent", agentId: "agent:external", requestId: "request:external" },
});
loopSession = advanceAgentHumanSession(loopSession, { status: "completed" }, loopSession.revision);
const sessionStore = new MemoryAgentHumanSessionStore();
await sessionStore.put(loopSession);
let executions = 0;
const continuation = await executeStoredAgentHumanSession({
  sessionId: loopSession.id,
  store: sessionStore,
  executor: {
    name: "external-consumer-executor",
    async execute(request) {
      executions += 1;
      if (request.idempotencyKey !== "idempotency:consumer:approve") {
        throw new Error("Executor did not receive the original idempotency key.");
      }
      return {
        status: "succeeded",
        result: { approved: true, external: true },
        facts: [{ kind: "set", target: "entity:change", property: "prop:approved", value: true }],
        evidence: ["evidence:external:approval"],
      };
    },
  },
});
if (continuation.status !== "executed" || executions !== 1) {
  throw new Error("Verified external agent continuation did not execute exactly once.");
}
const approved = continuation.session.document.objects
  .find((object) => object.id === "entity:change")
  ?.fields?.find((field) => field.key === "prop:approved")?.value;
if (approved !== true) throw new Error("Verified execution did not materialize the authoritative fact update.");
const repeated = await executeStoredAgentHumanSession({
  sessionId: loopSession.id,
  store: sessionStore,
  executor: {
    name: "must-not-run",
    async execute() {
      executions += 1;
      return { status: "succeeded" };
    },
  },
});
if (repeated.status !== "already-completed" || executions !== 1) {
  throw new Error("Idempotent continuation allowed duplicate execution.");
}
const notification = notificationForAgentHumanSession({
  session: continuation.session,
  appBaseUrl: "https://app.example/juanpager/",
});
if (!notification.launchUrl.endsWith("#v=5&session=session%3Aconsumer%3Aloop")) {
  throw new Error("Notification entrypoint did not preserve the durable session handoff.");
}

console.log("Packed JuanPager SDK verified from a clean consumer project, including verified agent continuation.");
`;

try {
  await execute("npm", ["run", "build:sdk"], { cwd: root, maxBuffer: 10 * 1024 * 1024 });
  const packed = await execute("npm", ["pack", "--ignore-scripts", "--json"], {
    cwd: root,
    maxBuffer: 10 * 1024 * 1024,
  });
  const result = JSON.parse(packed.stdout) as Array<{ filename?: string }>;
  const filename = result[0]?.filename;
  if (!filename) throw new Error("npm pack did not return a tarball filename.");
  tarballPath = resolve(root, filename);

  await writeFile(join(consumerDirectory, "package.json"), `${JSON.stringify({
    name: "juanpager-clean-room-consumer",
    private: true,
    type: "module",
    dependencies: { juanpager: `file:${tarballPath}` },
  }, null, 2)}\n`, "utf8");
  await writeFile(join(consumerDirectory, "consumer.mjs"), consumerSource, "utf8");

  await execute("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: consumerDirectory,
    maxBuffer: 20 * 1024 * 1024,
  });
  const execution = await execute(process.execPath, ["consumer.mjs"], {
    cwd: consumerDirectory,
    maxBuffer: 10 * 1024 * 1024,
  });
  process.stdout.write(execution.stdout);
  process.stderr.write(execution.stderr);
} finally {
  await rm(consumerDirectory, { recursive: true, force: true });
  if (tarballPath) await rm(tarballPath, { force: true });
}
