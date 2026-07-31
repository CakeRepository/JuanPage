import { builderPath, getAppBasePath, parseFragment } from "./encoding/fragment.js";
import {
  buildPageShareUrl,
  decodePage,
  PagePayloadError,
  type PagePayloadEncoding,
} from "./encoding/pagePipeline.js";
import { futureWorkspace } from "./examples/future-workspace.js";
import { renderPage } from "./rendering/renderPage.js";
import type { JuanPageDocument } from "./schema/page.js";
import { DocumentValidationError } from "./schema/document.js";

function appBaseUrl(): string {
  return new URL(getAppBasePath(), window.location.origin).toString();
}

function errorPage(error: unknown): JuanPageDocument {
  const validation = error instanceof DocumentValidationError;
  const payload = error instanceof PagePayloadError;
  const details =
    validation || payload
      ? error.details
      : error instanceof Error
        ? error.stack ?? error.message
        : String(error);

  return {
    version: "1.0",
    title: "This world could not be opened",
    intent: "JuanPager rejected data it could not safely understand.",
    description:
      "JuanPage 1.0 is the only public contract. The link may be truncated, malformed, or built for a retired schema.",
    theme: "dark",
    view: { defaultLens: "cards", groupBy: "none" },
    metrics: [
      { id: "safety", label: "Renderer state", operation: "value", value: "Safe failure" },
      { id: "schema", label: "Expected schema", operation: "value", value: "JuanPage 1.0" },
    ],
    objects: [
      {
        id: "error",
        type: "system-error",
        name: validation || payload ? error.message : "Unable to decode this JuanPage",
        status: "Blocked",
        tone: "danger",
        summary: "No untrusted markup or partial document was rendered.",
        fields: [
          { key: "details", value: details.slice(0, 2000), format: "code" },
          { key: "recovery", value: "Return home or rebuild the page with the JuanPage 1.0 builder." },
        ],
        actionIds: ["open-repository"],
      },
    ],
    actions: [
      {
        id: "open-repository",
        kind: "open",
        label: "Open documentation",
        url: "https://github.com/CakeRepository/juanpager#readme",
      },
    ],
  };
}

async function bootstrap(): Promise<void> {
  const mount = document.getElementById("app");
  if (!mount) return;

  const hash = window.location.hash;
  const fragment = parseFragment(hash);

  if (!fragment.data) {
    renderPage(futureWorkspace, mount, {
      builderHref: builderPath(),
      onShare: () => buildPageShareUrl(futureWorkspace, appBaseUrl()),
    });
    return;
  }

  try {
    if (fragment.version && fragment.version !== "3") {
      throw new Error(`Unsupported fragment version v=${fragment.version}. JuanPage 1.0 uses v=3.`);
    }
    const page = await decodePage(
      fragment.data,
      fragment.encoding as PagePayloadEncoding | undefined,
    );
    renderPage(page, mount, {
      builderHref: builderPath(),
      onShare: () => window.location.href,
    });
  } catch (error) {
    renderPage(errorPage(error), mount, { builderHref: builderPath() });
  }
}

window.addEventListener("hashchange", () => {
  void bootstrap();
});

void bootstrap();
