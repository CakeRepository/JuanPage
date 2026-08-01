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
  pageWithSharedInteractionState,
  MAX_SHARED_INTERACTIONS,
  type SharedInteractionEntry,
} from "./encoding/shareableInteraction.js";
import { operationsControlRoomPacket } from "./examples/operations-control-room.js";
import {
  juanPagerInstallAvailable,
  promptJuanPagerInstall,
  registerJuanPagerPwa,
} from "./pwa.js";
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
  advanceAgentHumanSession,
  agentHumanSessionExpired,
  sessionLaunchUrl,
  type AgentHumanSession,
} from "./session/session.js";
import {
  createConfiguredSessionStore,
  type AgentHumanSessionStore,
} from "./session/store.js";
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
    description: "The runtime accepts JuanPage 2.0, an M1 meaning packet, a record-only M1 URL session, or a durable agent-human session.",
    theme: "dark",
    objects: [{
      id: "error",
      type: "system-error",
      name: known ? error.message : "Unable to decode this JuanPage",
      status: "Blocked",
      tone: "danger",
      summary: "No untrusted markup, generated code, or partial document was rendered.",
      fields: [
        { key: "details", value: details.slice(0, 2000), format: "code" },
        { key: "recovery", value: "Return home, reopen the session, or rebuild the packet with the JuanPager builder." },
      ],
    }],
  };
}

let removeMeaningBridge: (() => void) | undefined;
let removeRuntimeBridge: (() => void) | undefined;
let activitySequence = 0;
const browserTransport = createBrowserEventTransport(window);
const configuredSessionStore = createConfiguredSessionStore();

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

function setRuntimeStatus(mount: HTMLElement, message: string, failed = false): void {
  const status = mount.querySelector<HTMLElement>(".jp-u-runtime-status");
  if (!status) return;
  status.textContent = message;
  status.className = `jp-u-runtime-status ${failed ? "is-error" : "is-success"}`;
}

type RuntimeOptions = Readonly<{
  meaningSession?: MeaningSession;
  durableSession?: AgentHumanSession;
  sessionStore?: AgentHumanSessionStore;
}>;

function render(page: JuanPageDocument, mount: HTMLElement, options: RuntimeOptions = {}): void {
  removeRuntimeBridge?.();
  const bridge = createMeaningBridge(page, options.meaningSession);
  let durableSession = options.durableSession;
  const sessionStore = options.sessionStore;
  let activity = [
    ...interactionLedgerFromPage(page),
    ...(options.meaningSession ? interactionLedgerFromMeaningSession(options.meaningSession) : []),
  ].slice(-MAX_SHARED_INTERACTIONS);

  const currentState = (): PageState => loadPageState(pageStateKey(page), page);
  const currentDocument = (): JuanPageDocument => pageWithSharedInteractionState(page, currentState(), activity);

  const persistDurableSession = async (status = durableSession?.status): Promise<string> => {
    if (!durableSession || !sessionStore) throw new Error("This durable session has no storage transport.");
    const expectedRevision = durableSession.revision;
    const next = advanceAgentHumanSession(durableSession, {
      document: currentDocument(),
      meaning: bridge.session?.() ?? durableSession.meaning,
      status,
    }, expectedRevision);
    durableSession = await sessionStore.put(next, expectedRevision);
    return sessionLaunchUrl(durableSession.id, appBaseUrl());
  };

  const buildShareUrl = async (): Promise<string> => {
    if (durableSession) return persistDurableSession();
    if (bridge.session) return buildMeaningSessionShareUrl(bridge.session(), appBaseUrl());
    return buildInteractivePageShareUrl(page, currentState(), appBaseUrl(), "gz", activity);
  };

  const synchronize = async (): Promise<string> => {
    try {
      const url = await buildShareUrl();
      replaceShareUrl(url);
      return url;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRuntimeStatus(mount, `State could not be synchronized: ${message}`, true);
      throw error;
    }
  };

  const record = (entry: SharedInteractionEntry): void => {
    activity = [...activity, entry].slice(-MAX_SHARED_INTERACTIONS);
  };

  const interactionListener = (event: Event): void => {
    const mutation = (event as CustomEvent<PageInteractionMutation>).detail;
    if (!mutation) return;
    queueMicrotask(() => {
      record(mutationActivity(currentState(), mutation));
      void synchronize().catch((error) => console.error("JuanPager could not synchronize the interaction state", error));
    });
  };
  window.addEventListener("juanpager:interaction", interactionListener);

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

  const ensureRuntimeControls = (): void => {
    const utility = mount.querySelector<HTMLElement>(".jp-u-utility");
    if (!utility) return;
    if (juanPagerInstallAvailable() && !utility.querySelector('[data-runtime-control="install"]')) {
      const install = document.createElement("button");
      install.type = "button";
      install.className = "jp-u-button is-quiet";
      install.dataset.runtimeControl = "install";
      install.textContent = "Install";
      install.addEventListener("click", () => {
        void promptJuanPagerInstall().then((outcome) => {
          setRuntimeStatus(mount, outcome === "accepted" ? "JuanPager installed." : "Installation was not completed.", outcome === "unavailable");
          ensureRuntimeControls();
        });
      });
      utility.prepend(install);
    }
    if (durableSession && !utility.querySelector('[data-runtime-control="complete"]')) {
      const complete = document.createElement("button");
      complete.type = "button";
      complete.className = "jp-u-button jp-u-success";
      complete.dataset.runtimeControl = "complete";
      complete.textContent = durableSession.status === "completed" ? "Completed" : "Complete";
      complete.disabled = durableSession.status === "completed";
      complete.addEventListener("click", () => {
        void persistDurableSession("completed")
          .then((url) => {
            replaceShareUrl(url);
            complete.textContent = "Completed";
            complete.disabled = true;
            setRuntimeStatus(mount, "Human work completed. The originating agent can resume from this session.");
          })
          .catch((error) => setRuntimeStatus(mount, `Completion failed: ${error instanceof Error ? error.message : String(error)}`, true));
      });
      utility.prepend(complete);
    }
  };

  const observer = new MutationObserver(ensureRuntimeControls);
  observer.observe(mount, { childList: true, subtree: true });
  const installabilityListener = (): void => ensureRuntimeControls();
  window.addEventListener("juanpager:installability", installabilityListener);
  ensureRuntimeControls();

  removeRuntimeBridge = () => {
    window.removeEventListener("juanpager:interaction", interactionListener);
    window.removeEventListener("juanpager:installability", installabilityListener);
    observer.disconnect();
  };
}

async function bootstrap(): Promise<void> {
  const mount = document.getElementById("app");
  if (!mount) return;
  const fragment = parseFragment(window.location.hash);
  try {
    if (fragment.version && fragment.version !== "5") throw new Error(`Unsupported fragment version v=${fragment.version}. JuanPage 2.0 links use v=5.`);
    if (fragment.session) {
      const session = await configuredSessionStore.get(fragment.session);
      if (!session) throw new Error(`Session ${fragment.session} was not found in ${configuredSessionStore.name} storage.`);
      if (agentHumanSessionExpired(session)) throw new Error(`Session ${fragment.session} has expired.`);
      render(session.document, mount, {
        meaningSession: session.meaning,
        durableSession: session,
        sessionStore: configuredSessionStore,
      });
      return;
    }
    if (!fragment.data) {
      const page = materializeMeaningPacket(operationsControlRoomPacket, browserRendererCapabilities());
      const session = createMeaningSession(operationsControlRoomPacket);
      render(page, mount, { meaningSession: session });
      return;
    }
    const decoded = await decodePagePayload(fragment.data, fragment.encoding as PagePayloadEncoding | undefined);
    if (decoded.kind === "m1-session") {
      render(decoded.page, mount, { meaningSession: decoded.session });
      return;
    }
    if (decoded.kind === "m1") {
      render(decoded.page, mount, { meaningSession: createMeaningSession(decoded.packet) });
      return;
    }
    render(decoded.page, mount);
  } catch (error) {
    render(errorPage(error), mount);
  }
}

registerJuanPagerPwa();
window.addEventListener("hashchange", () => { void bootstrap(); });
void bootstrap();
