import { builderPath, getAppBasePath, parseFragment } from "./encoding/fragment.js";
import {
  appendMeaningSessionDelta,
  buildMeaningSessionShareUrl,
  createMeaningSession,
  decodePagePayload,
  PagePayloadError,
  type MeaningSession,
  type PagePayloadEncoding,
} from "./encoding/pagePipeline.js";
import {
  buildInteractivePageShareUrl,
  interactionLedgerFromMeaningSession,
  interactionLedgerFromPage,
  MAX_SHARED_INTERACTIONS,
  type SharedInteractionEntry,
} from "./encoding/shareableInteraction.js";
import { operationsControlRoomPacket } from "./examples/operations-control-room.js";
import {
  browserRendererCapabilities,
  createActionDelta,
  createActionReceipt,
  createFactDelta,
  createScopeDelta,
  createSelectionDelta,
  materializeMeaningPacket,
  MeaningProtocolError,
  type ActionPolicy,
  type ActionReceipt,
  type MeaningDelta,
} from "./protocol/meaning.js";
import { createInteractionStateDelta, createPageTransactionDelta } from "./protocol/interaction.js";
import { renderPage, type PageAffordanceInvocation } from "./rendering/renderPage.js";
import { DocumentValidationError } from "./schema/errors.js";
import type { JuanPageDocument, PageScalar } from "./schema/page.js";
import {
  loadPageState,
  pageStateKey,
  type PageInteractionMutation,
  type PageState,
} from "./state/pageState.js";
import {
  createBrowserEventTransport,
  deltaMessage,
  receiptMessage,
  type MeaningTransport,
} from "./transport/adapters.js";

function appBaseUrl(): string {
  return new URL(getAppBasePath(), window.location.origin).toString();
}

function errorPage(error: unknown): JuanPageDocument {
  const known = error instanceof DocumentValidationError || error instanceof PagePayloadError || error instanceof MeaningProtocolError;
  const details = known ? error.details : error instanceof Error ? error.stack ?? error.message : String(error);
  return {
    version: "2.0",
    title: "This world could not be opened",
    intent: "JuanPager rejected data it could not safely understand.",
    description: "The runtime accepts JuanPage 2.0, an M1 meaning packet, or a record-only M1 URL session.",
    theme: "dark",
    objects: [{
      id: "error",
      type: "system-error",
      name: known ? error.message : "Unable to decode this JuanPage",
      status: "Blocked",
      tone: "danger",
      summary: "No untrusted markup or partial document was rendered.",
      fields: [
        { key: "details", value: details.slice(0, 2000), format: "code" },
        { key: "recovery", value: "Return home or rebuild the packet with the JuanPager builder." },
      ],
    }],
  };
}

let removeMeaningBridge: (() => void) | undefined;
let removeShareBridge: (() => void) | undefined;
let activitySequence = 0;
const browserTransport = createBrowserEventTransport(window);

function policyFromPage(page: JuanPageDocument, affordanceId: string): ActionPolicy {
  const value = page.metadata?.[`m1.policy.${affordanceId}`];
  return value === "approval" || value === "deny" ? value : "allow";
}

function scalarArgs(page: JuanPageDocument, invocation: PageAffordanceInvocation): Readonly<Record<string, PageScalar>> {
  const operation = page.metadata?.[`m1.operation.${invocation.affordanceId}`];
  const args: Record<string, PageScalar> = {
    effect: invocation.effect,
    objectId: invocation.objectId ?? null,
    value: invocation.value ?? null,
    operation: typeof operation === "string" ? operation : invocation.operation ?? null,
    focus: invocation.interaction.focus ?? null,
  };
  for (const [scope, value] of Object.entries(invocation.scopes)) args[`scope.${scope}`] = value;
  for (const [selection, values] of Object.entries(invocation.selections)) args[`selection.${selection}`] = values.join(",");
  return args;
}

function createMeaningBridge(
  page: JuanPageDocument,
  initialSession?: MeaningSession,
  transport: MeaningTransport = browserTransport,
): {
  onAffordance?: (invocation: PageAffordanceInvocation) => Promise<void>;
  session?: () => MeaningSession;
} {
  removeMeaningBridge?.();
  const packetId = page.metadata?.["m1.packetId"];
  const initialRevision = page.metadata?.["m1.revision"];
  if (typeof packetId !== "string" || typeof initialRevision !== "number") return {};

  let revision = initialRevision;
  let session = initialSession;
  const sendDelta = async (delta: MeaningDelta, receipt?: ActionReceipt): Promise<void> => {
    revision = delta[3];
    if (session) session = appendMeaningSessionDelta(session, delta, receipt);
    await transport.send(deltaMessage(delta));
    if (receipt) await transport.send(receiptMessage(receipt));
  };

  const interactionListener = (event: Event): void => {
    const mutation = (event as CustomEvent<PageInteractionMutation>).detail;
    if (!mutation) return;
    let delta: MeaningDelta;
    let receipt: ActionReceipt | undefined;
    if (mutation.kind === "set") delta = createFactDelta(packetId, revision, mutation.target, mutation.field, mutation.value);
    else if (mutation.kind === "scope") delta = createScopeDelta(packetId, revision, mutation.scope, mutation.value);
    else if (mutation.kind === "select") delta = createSelectionDelta(packetId, revision, mutation.selection, mutation.values);
    else if (mutation.kind === "state") {
      delta = createInteractionStateDelta(packetId, revision, mutation.state, mutation.key, mutation.value);
      receipt = createActionReceipt(delta, "succeeded", { execution: "local-state", domain: mutation.state });
    } else {
      delta = createPageTransactionDelta(packetId, revision, mutation.transactionId, mutation.action, mutation.patches);
      receipt = createActionReceipt(delta, mutation.action === "cancel" ? "cancelled" : "succeeded", {
        execution: "local-transaction",
        action: mutation.action,
        patches: mutation.patches.length,
      });
    }
    void sendDelta(delta, receipt).catch((error) => {
      console.error("JuanPager could not record an M1 interaction delta", error);
    });
  };
  window.addEventListener("juanpager:interaction", interactionListener);
  removeMeaningBridge = () => window.removeEventListener("juanpager:interaction", interactionListener);

  return {
    session: session ? () => session! : undefined,
    async onAffordance(invocation): Promise<void> {
      const policy = policyFromPage(page, invocation.affordanceId);
      const target = invocation.objectId ?? null;
      const delta = createActionDelta(
        packetId,
        revision,
        "actor:human:browser",
        invocation.affordanceId,
        target,
        scalarArgs(page, invocation),
        policy,
      );
      const receipt = createActionReceipt(delta, policy === "approval" ? "proposed" : "authorized", {
        transport: transport.name,
        execution: "record-only",
        affordance: invocation.affordanceId,
        effect: invocation.effect,
        operation: invocation.operation ?? null,
      });
      await sendDelta(delta, receipt);
    },
  };
}

function transactionForMutation(state: PageState, mutation: PageInteractionMutation) {
  if (mutation.kind === "transaction") {
    return [...state.history, ...state.future].find((transaction) => transaction.id === mutation.transactionId);
  }
  return state.history.at(-1);
}

function mutationActivity(state: PageState, mutation: PageInteractionMutation): SharedInteractionEntry {
  activitySequence += 1;
  const transaction = transactionForMutation(state, mutation);
  const action = mutation.kind === "transaction" ? `${mutation.action[0]?.toUpperCase()}${mutation.action.slice(1)} · ` : "";
  return {
    id: transaction
      ? `${transaction.id}:${mutation.kind === "transaction" ? mutation.action : "commit"}:${activitySequence}`
      : `activity:${Date.now().toString(36)}:${activitySequence.toString(36)}`,
    label: `${action}${transaction?.label ?? mutation.kind}`,
    timestamp: new Date().toISOString(),
    patches: mutation.kind === "transaction" ? mutation.patches.length : transaction?.patches.length ?? 1,
  };
}

function affordanceActivity(invocation: PageAffordanceInvocation): SharedInteractionEntry {
  activitySequence += 1;
  const operation = invocation.operation ?? invocation.affordanceId;
  return {
    id: `affordance:${Date.now().toString(36)}:${activitySequence.toString(36)}`,
    label: `${invocation.effect[0]?.toUpperCase()}${invocation.effect.slice(1)} · ${operation}`,
    timestamp: new Date().toISOString(),
    patches: 0,
  };
}

function replaceShareUrl(url: string): void {
  const parsed = new URL(url);
  window.history.replaceState(null, "", `${parsed.pathname}${parsed.search}${parsed.hash}`);
}

function render(
  page: JuanPageDocument,
  mount: HTMLElement,
  options: { session?: MeaningSession } = {},
): void {
  removeShareBridge?.();
  const bridge = createMeaningBridge(page, options.session);
  let activity = [
    ...interactionLedgerFromPage(page),
    ...(options.session ? interactionLedgerFromMeaningSession(options.session) : []),
  ].slice(-MAX_SHARED_INTERACTIONS);

  const currentState = (): PageState => loadPageState(pageStateKey(page), page);
  const buildShareUrl = async (): Promise<string> => bridge.session
    ? buildMeaningSessionShareUrl(bridge.session(), appBaseUrl())
    : buildInteractivePageShareUrl(page, currentState(), appBaseUrl(), "gz", activity);

  const synchronize = async (): Promise<string> => {
    const url = await buildShareUrl();
    replaceShareUrl(url);
    return url;
  };

  const record = (entry: SharedInteractionEntry): void => {
    activity = [...activity, entry].slice(-MAX_SHARED_INTERACTIONS);
  };

  const interactionListener = (event: Event): void => {
    const mutation = (event as CustomEvent<PageInteractionMutation>).detail;
    if (!mutation) return;
    queueMicrotask(() => {
      record(mutationActivity(currentState(), mutation));
      void synchronize().catch((error) => console.error("JuanPager could not synchronize the interaction URL", error));
    });
  };
  window.addEventListener("juanpager:interaction", interactionListener);
  removeShareBridge = () => window.removeEventListener("juanpager:interaction", interactionListener);

  const onAffordance = async (invocation: PageAffordanceInvocation): Promise<void> => {
    await bridge.onAffordance?.(invocation);
    record(affordanceActivity(invocation));
    await synchronize();
  };

  renderPage(page, mount, {
    builderHref: builderPath(),
    onShare: synchronize,
    onAffordance,
  });
}

async function bootstrap(): Promise<void> {
  const mount = document.getElementById("app");
  if (!mount) return;
  const fragment = parseFragment(window.location.hash);
  if (!fragment.data) {
    const page = materializeMeaningPacket(operationsControlRoomPacket, browserRendererCapabilities());
    const session = createMeaningSession(operationsControlRoomPacket);
    render(page, mount, { session });
    return;
  }
  try {
    if (fragment.version && fragment.version !== "5") throw new Error(`Unsupported fragment version v=${fragment.version}. JuanPage 2.0 links use v=5.`);
    const decoded = await decodePagePayload(fragment.data, fragment.encoding as PagePayloadEncoding | undefined);
    if (decoded.kind === "m1-session") {
      render(decoded.page, mount, { session: decoded.session });
      return;
    }
    if (decoded.kind === "m1") {
      render(decoded.page, mount, { session: createMeaningSession(decoded.packet) });
      return;
    }
    render(decoded.page, mount);
  } catch (error) {
    render(errorPage(error), mount);
  }
}

window.addEventListener("hashchange", () => { void bootstrap(); });
void bootstrap();
