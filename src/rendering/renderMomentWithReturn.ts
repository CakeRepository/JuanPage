import "../return.css";
import { parseFragment, withReceiptOverlay } from "../encoding/fragment.js";
import {
  buildMomentReceipt,
  buildMomentReceiptText,
  encodeMomentReceiptToken,
  receiptHasChanges,
} from "../protocol/receipt.js";
import type { JuanPagerMomentDoc } from "../schema/moment.js";
import {
  LOCAL_STATE_EVENT,
  loadLocalState,
  momentStateKey,
  saveLocalState,
  type LocalPageState,
} from "../state/localState.js";
import { announce, append, el } from "./dom.js";
import { renderMoment } from "./renderMoment.js";
import type { RenderHandle } from "./render.js";

async function shareOrCopy(
  title: string,
  text: string,
  url: string,
): Promise<"shared" | "copied"> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
    }
  }

  await navigator.clipboard.writeText(`${text}\n\nUpdated page: ${url}`);
  return "copied";
}

function isInteractive(moment: JuanPagerMomentDoc): boolean {
  return moment.affordances.includes("check") || moment.affordances.includes("adjust-qty");
}

function writeLivingLink(moment: JuanPagerMomentDoc, state: LocalPageState): string {
  const receipt = buildMomentReceipt(moment, state);
  const overlay = receiptHasChanges(receipt) ? encodeMomentReceiptToken(receipt) : undefined;
  const nextHash = withReceiptOverlay(window.location.hash, overlay);
  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
  window.history.replaceState(null, "", nextUrl);
  return window.location.href;
}

/**
 * Every interactive moment is a living link. Human changes remain local while
 * editing, but the URL continuously carries a compact delta receipt that can
 * be shared back to an agent or opened on another device.
 */
export function renderMomentWithReturn(
  moment: JuanPagerMomentDoc,
  mount: HTMLElement,
): RenderHandle {
  const handle = renderMoment(moment, mount);
  if (!isInteractive(moment)) return handle;

  const content = handle.root.querySelector(".jp-content");
  if (!(content instanceof HTMLElement)) return handle;

  const stateKey = momentStateKey(moment);
  const state = loadLocalState(stateKey);
  writeLivingLink(moment, state);

  const onState = (event: Event): void => {
    const custom = event as CustomEvent<{ key: string; state: LocalPageState }>;
    if (custom.detail?.key !== stateKey) return;
    writeLivingLink(moment, custom.detail.state);
  };
  window.addEventListener(LOCAL_STATE_EVENT, onState);

  const panel = el("section", {
    className: "jp-return",
    attrs: { "aria-labelledby": "jp-return-title" },
  });
  const heading = el("h2", {
    className: "jp-return-title",
    text: "Continue this conversation",
    attrs: { id: "jp-return-title" },
  });
  const explanation = el("p", {
    className: "jp-return-copy",
    text: "This link updates as you work. Share it back and the next agent can see only your changes, without a backend or account.",
  });
  const label = el("label", {
    className: "jp-return-label",
    text: "Optional note for the agent",
    attrs: { for: "jp-return-note" },
  });
  const note = el("textarea", {
    className: "jp-return-note",
    attrs: {
      id: "jp-return-note",
      rows: "3",
      maxlength: "1000",
      placeholder: "Example: Blueberries were out of stock, so I bought strawberries instead.",
    },
  }) as HTMLTextAreaElement;
  note.value = state.responseNote ?? "";
  note.addEventListener("input", () => {
    const latest = loadLocalState(stateKey);
    latest.responseNote = note.value;
    saveLocalState(stateKey, latest);
  });

  const status = el("p", {
    className: "jp-return-copy",
    text: parseFragment(window.location.hash).receipt
      ? "The current URL includes your latest changes."
      : "Make a change and the URL will become a portable update.",
    attrs: { "aria-live": "polite" },
  });

  const button = el("button", {
    className: "jp-btn jp-btn-primary jp-return-button",
    text: "Share updated page",
    attrs: { type: "button", "data-affordance": "return" },
  }) as HTMLButtonElement;
  button.addEventListener("click", () => {
    const latest = loadLocalState(stateKey);
    const url = writeLivingLink(moment, latest);
    const text = buildMomentReceiptText(moment, latest);
    button.disabled = true;
    void shareOrCopy(`${moment.title} update`, text, url)
      .then((result) => {
        status.textContent =
          result === "shared"
            ? "Updated page shared."
            : "Updated page and receipt copied.";
        announce(handle.root, status.textContent);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          announce(handle.root, "Could not share the updated page");
        }
      })
      .finally(() => {
        button.disabled = false;
      });
  });

  append(panel, heading, explanation, label, note, status, button);
  content.append(panel);

  return {
    root: handle.root,
    destroy: () => {
      window.removeEventListener(LOCAL_STATE_EVENT, onState);
      handle.destroy();
    },
  };
}
