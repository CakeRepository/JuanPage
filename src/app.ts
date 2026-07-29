import { clearFragment, docsUrl } from "./encoding/fragment.js";
import { encodeToFragment, PayloadLimitError } from "./encoding/pipeline.js";
import { groceryCheckout } from "./examples/grocery-checkout.js";
import { renderDocument, renderError } from "./rendering/render.js";
import { renderMoment } from "./rendering/renderMoment.js";
import type { LoadedDocument } from "./schema/anyDocument.js";
import { DocumentValidationError } from "./schema/document.js";
import { FragmentDocumentSource } from "./sources/FragmentDocumentSource.js";

function renderLoaded(loaded: LoadedDocument, mount: HTMLElement): void {
  if (loaded.kind === "moment") {
    renderMoment(loaded.document, mount);
    return;
  }
  renderDocument(loaded.document, mount);
}

async function loadDemo(): Promise<void> {
  const fragment = await encodeToFragment(groceryCheckout);
  window.location.hash = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  // hashchange will re-bootstrap; call directly for reliability
  await bootstrap();
}

async function bootstrap(): Promise<void> {
  const mount = document.getElementById("app");
  if (!mount) return;

  const hash = window.location.hash;
  if (!hash || !hash.includes("data=")) {
    renderError(mount, {
      title: "No page loaded",
      explanation:
        "Open a JuanPager link with embedded page data, generate one in the builder, or load the grocery checkout demo.",
      details:
        "Expected URL fragment format: #v=2&enc=gz&data=ENCODED_PAYLOAD (moments) or #v=1&data=ENCODED_PAYLOAD (0.1 documents)",
      onDemo: () => {
        void loadDemo();
      },
      onClear: () => {
        clearFragment();
        void bootstrap();
      },
      docsHref: docsUrl(),
    });
    return;
  }

  try {
    const source = new FragmentDocumentSource(hash);
    renderLoaded(await source.load(), mount);
  } catch (error) {
    const title =
      error instanceof PayloadLimitError || error instanceof DocumentValidationError
        ? error.message
        : "Unable to open this JuanPager";
    const explanation =
      error instanceof PayloadLimitError
        ? "The embedded document is too large or malformed for this format."
        : error instanceof DocumentValidationError
          ? "The document failed schema validation. Agents must emit only supported moments, entities, affordances, and safe URLs."
          : "Decoding or validation failed. The link may be truncated, corrupted, or built for a newer format.";
    const details =
      error instanceof DocumentValidationError || error instanceof PayloadLimitError
        ? error.details
        : error instanceof Error
          ? error.stack ?? error.message
          : String(error);

    renderError(mount, {
      title,
      explanation,
      details,
      onDemo: () => {
        void loadDemo();
      },
      onClear: () => {
        clearFragment();
        void bootstrap();
      },
      docsHref: docsUrl(),
    });
  }
}

window.addEventListener("hashchange", () => {
  void bootstrap();
});

void bootstrap();
