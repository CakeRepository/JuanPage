import { builderPath, getAppBasePath, parseFragment } from "./encoding/fragment.js";
import {
  buildMeaningShareUrl,
  decodePage,
  PagePayloadError,
  type PagePayloadEncoding,
} from "./encoding/pagePipeline.js";
import { futureMeaningPacket } from "./examples/meaning-workspace.js";
import {
  browserRendererCapabilities,
  createFactDelta,
  materializeMeaningPacket,
  MeaningProtocolError,
  type MeaningDelta,
} from "./protocol/meaning.js";
import { renderPage } from "./rendering/renderPage.js";
import { DocumentValidationError } from "./schema/errors.js";
import type { JuanPageDocument } from "./schema/page.js";
import type { PageValueMutation } from "./state/pageState.js";

function appBaseUrl(): string {
  return new URL(getAppBasePath(), window.location.origin).toString();
}

function errorPage(error: unknown): JuanPageDocument {
  const known = error instanceof DocumentValidationError || error instanceof PagePayloadError || error instanceof MeaningProtocolError;
  const details = known ? error.details : error instanceof Error ? error.stack ?? error.message : String(error);
  return {
    version: "1.0",
    title: "This world could not be opened",
    intent: "JuanPager rejected data it could not safely understand.",
    description: "The runtime accepts JuanPage 1.0 or an M1 meaning packet that compiles into JuanPage 1.0.",
    theme: "dark",
    view: { defaultLens: "cards", groupBy: "none" },
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

let removeValueBridge: (() => void) | undefined;

function bridgeMeaningDeltas(page: JuanPageDocument): void {
  removeValueBridge?.();
  const packetId = page.metadata?.["m1.packetId"];
  const initialRevision = page.metadata?.["m1.revision"];
  if (typeof packetId !== "string" || typeof initialRevision !== "number") return;

  let revision = initialRevision;
  const listener = (event: Event): void => {
    const mutation = (event as CustomEvent<PageValueMutation>).detail;
    if (!mutation) return;
    const delta: MeaningDelta = createFactDelta(packetId, revision, mutation.target, mutation.field, mutation.value);
    revision = delta[3];
    window.dispatchEvent(new CustomEvent<MeaningDelta>("juanpager:delta", { detail: delta }));
    console.info("JuanPager M1 delta", delta);
  };
  window.addEventListener("juanpager:value", listener);
  removeValueBridge = () => window.removeEventListener("juanpager:value", listener);
}

function render(page: JuanPageDocument, mount: HTMLElement, onShare?: () => string | Promise<string>): void {
  bridgeMeaningDeltas(page);
  renderPage(page, mount, { builderHref: builderPath(), onShare });
}

async function bootstrap(): Promise<void> {
  const mount = document.getElementById("app");
  if (!mount) return;

  const fragment = parseFragment(window.location.hash);
  if (!fragment.data) {
    const page = materializeMeaningPacket(futureMeaningPacket, browserRendererCapabilities());
    render(page, mount, () => buildMeaningShareUrl(futureMeaningPacket, appBaseUrl()));
    return;
  }

  try {
    if (fragment.version && fragment.version !== "3") {
      throw new Error(`Unsupported fragment version v=${fragment.version}. JuanPage 1.0 uses v=3.`);
    }
    const page = await decodePage(fragment.data, fragment.encoding as PagePayloadEncoding | undefined);
    render(page, mount, () => window.location.href);
  } catch (error) {
    render(errorPage(error), mount);
  }
}

window.addEventListener("hashchange", () => { void bootstrap(); });
void bootstrap();
