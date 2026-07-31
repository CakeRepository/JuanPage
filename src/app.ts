import { clearFragment, docsUrl, parseFragment } from "./encoding/fragment.js";
import { encodeToFragment, PayloadLimitError } from "./encoding/pipeline.js";
import { groceryCheckout } from "./examples/grocery-checkout.js";
import { decodeMomentReceipt, stateFromReceipt } from "./protocol/receipt.js";
import { renderDocument, renderError } from "./rendering/render.js";
import { renderMomentWithReturn } from "./rendering/renderMomentWithReturn.js";
import { renderWelcome } from "./rendering/renderWelcome.js";
import type { LoadedDocument } from "./schema/anyDocument.js";
import { DocumentValidationError } from "./schema/document.js";
import { FragmentDocumentSource } from "./sources/FragmentDocumentSource.js";
import { momentStateKey, saveLocalState } from "./state/localState.js";

function renderLoaded(loaded: LoadedDocument, mount: HTMLElement, hash: string): void {
  if (loaded.kind === "moment") {
    const receiptToken = parseFragment(hash).receipt;
    if (receiptToken) {
      try {
        const state = stateFromReceipt(loaded.document, decodeMomentReceipt(receiptToken));
        saveLocalState(momentStateKey(loaded.document), state);
      } catch (error) {
        console.warn("Ignoring invalid JuanPager receipt overlay", error);
      }
    }
    renderMomentWithReturn(loaded.document, mount);
    return;
  }
  renderDocument(loaded.document, mount);
}

async function loadDemo(): Promise<void> {
  const fragment = await encodeToFragment(groceryCheckout);
  window.location.hash = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  await bootstrap();
}

async function bootstrap(): Promise<void> {
  const mount = document.getElementById("app");
  if (!mount) return;

  const hash = window.location.hash;
  if (!hash || !hash.includes("data=")) {
    renderWelcome(mount, {
      onDemo: () => {
        void loadDemo();
      },
      docsHref: docsUrl(),
    });
    return;
  }

  try {
    const source = new FragmentDocumentSource(hash);
    renderLoaded(await source.load(), mount, hash);
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
