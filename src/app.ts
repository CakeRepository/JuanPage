import { clearFragment, docsUrl } from "./encoding/fragment.js";
import { encodeDocumentToFragment } from "./encoding/pipeline.js";
import { groceryPlan } from "./examples/grocery-plan.js";
import { renderDocument, renderError } from "./rendering/render.js";
import { DocumentValidationError } from "./schema/document.js";
import { PayloadLimitError } from "./encoding/pipeline.js";
import { FragmentDocumentSource } from "./sources/FragmentDocumentSource.js";

async function loadDemo(): Promise<void> {
  const fragment = await encodeDocumentToFragment(groceryPlan);
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
        "Open a JuanPager link with embedded page data, generate one in the builder, or load the grocery demo.",
      details:
        "Expected URL fragment format: #data=ENCODED_PAYLOAD or #v=1&data=ENCODED_PAYLOAD",
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
    const doc = await source.load();
    renderDocument(doc, mount);
  } catch (error) {
    const title =
      error instanceof PayloadLimitError || error instanceof DocumentValidationError
        ? error.message
        : "Unable to open this JuanPager";
    const explanation =
      error instanceof PayloadLimitError
        ? "The embedded document is too large or malformed for version 0.1."
        : error instanceof DocumentValidationError
          ? "The document failed schema validation. Agents must emit only supported components and safe URLs."
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
