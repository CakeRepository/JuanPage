import { builderPath, getAppBasePath, parseFragment } from "./encoding/fragment.js";
import {
  appendMeaningSessionDelta,
  buildMeaningSessionShareUrl,
  buildMeaningShareUrl,
  createMeaningSession,
  decodePagePayload,
  PagePayloadError,
  type MeaningSession,
  type PagePayloadEncoding,
} from "./encoding/pagePipeline.js";
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
  type MeaningDelta,
} from "./protocol/meaning.js";
import { renderPage, type PageAffordanceInvocation } from "./rendering/renderPage.js";
import { DocumentValidationError } from "./schema/errors.js";
import type { JuanPageDocument, PageScalar } from "./schema/page.js";
import type { PageInteractionMutation } from "./state/pageState.js";
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
  const sendDelta = async (delta: MeaningDelta): Promise<void> => {
    revision = delta[3];
    if (session) session = appendMeaningSessionDelta(session, delta);
    await transport.send(deltaMessage(delta));
  };

  const interactionListener = (event: Event): void => {
    const mutation = (event as CustomEvent<PageInteractionMutation>).detail;
    if (!mutation) return;
    let delta: MeaningDelta;
    if (mutation.kind === "set") delta = createFactDelta(packetId, revision, mutation.target, mutation.field, mutation.value);
    else if (mutation.kind === "scope") delta = createScopeDelta(packetId, revision, mutation.scope, mutation.value);
    else delta = createSelectionDelta(packetId, revision, mutation.selection, mutation.values);
    void sendDelta(delta).catch((error) => {
      console.error("JuanPager could not record an M1 interaction delta", error);
    });
  };
  window.addEventListener("juanpager:interaction", interactionListener);
  removeMeaningBridge = () => window.removeEventListener("juanpager:interaction", interactionListener);

  return {
    session: session ? () => session! : undefined,
    async onAffordance(invocation): Promise<void> {
      if (invocation.effect !== "invoke") return;
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
      });
      revision = delta[3];
      if (session) session = appendMeaningSessionDelta(session, delta, receipt);
      await transport.send(deltaMessage(delta));
      await transport.send(receiptMessage(receipt));
    },
  };
}

function render(
  page: JuanPageDocument,
  mount: HTMLElement,
  options: { session?: MeaningSession; onShare?: () => string | Promise<string> } = {},
): void {
  const bridge = createMeaningBridge(page, options.session);
  const onShare = bridge.session
    ? () => buildMeaningSessionShareUrl(bridge.session!(), appBaseUrl())
    : options.onShare;
  renderPage(page, mount, { builderHref: builderPath(), onShare, onAffordance: bridge.onAffordance });
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
    if (fragment.version && fragment.version !== "5") {
      throw new Error(`Unsupported fragment version v=${fragment.version}. JuanPage 2.0 links use v=5.`);
    }
    const decoded = await decodePagePayload(fragment.data, fragment.encoding as PagePayloadEncoding | undefined);
    if (decoded.kind === "m1-session") {
      render(decoded.page, mount, { session: decoded.session });
      return;
    }
    if (decoded.kind === "m1") {
      render(decoded.page, mount, { onShare: () => buildMeaningShareUrl(decoded.packet, appBaseUrl()) });
      return;
    }
    render(decoded.page, mount, { onShare: () => window.location.href });
  } catch (error) {
    render(errorPage(error), mount);
  }
}

window.addEventListener("hashchange", () => { void bootstrap(); });
void bootstrap();
