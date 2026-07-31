import "../return.css";
import { buildMomentReceiptText } from "../protocol/receipt.js";
import type { JuanPagerMomentDoc } from "../schema/moment.js";
import {
  loadLocalState,
  momentStateKey,
  saveLocalState,
} from "../state/localState.js";
import { announce, append, el } from "./dom.js";
import { renderMoment } from "./renderMoment.js";
import type { RenderHandle } from "./render.js";

async function shareOrCopy(title: string, text: string): Promise<"shared" | "copied"> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
    }
  }

  await navigator.clipboard.writeText(text);
  return "copied";
}

/**
 * Adds the optional Moment -> Receipt return path without changing the core
 * renderer. The receipt contains only local deltas and an optional note.
 */
export function renderMomentWithReturn(
  moment: JuanPagerMomentDoc,
  mount: HTMLElement,
): RenderHandle {
  const handle = renderMoment(moment, mount);
  if (!moment.affordances.includes("return")) return handle;

  const content = handle.root.querySelector(".jp-content");
  if (!(content instanceof HTMLElement)) return handle;

  const stateKey = momentStateKey(moment);
  const state = loadLocalState(stateKey);
  const panel = el("section", {
    className: "jp-return",
    attrs: { "aria-labelledby": "jp-return-title" },
  });
  const heading = el("h2", {
    className: "jp-return-title",
    text: "Send your update back",
    attrs: { id: "jp-return-title" },
  });
  const explanation = el("p", {
    className: "jp-return-copy",
    text: "JuanPager will send only what you changed, plus the note below. The original page is not duplicated.",
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
      placeholder: "Example: The blueberries were out of stock, so I bought strawberries instead.",
    },
  }) as HTMLTextAreaElement;
  note.value = state.responseNote ?? "";
  note.addEventListener("input", () => {
    state.responseNote = note.value;
    saveLocalState(stateKey, state);
  });

  const button = el("button", {
    className: "jp-btn jp-btn-primary jp-return-button",
    text: "Send update to agent",
    attrs: { type: "button", "data-affordance": "return" },
  }) as HTMLButtonElement;
  button.addEventListener("click", () => {
    const latest = loadLocalState(stateKey);
    const text = buildMomentReceiptText(moment, latest);
    button.disabled = true;
    void shareOrCopy(`${moment.title} update`, text)
      .then((result) => {
        announce(handle.root, result === "shared" ? "Update shared" : "Update copied");
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          announce(handle.root, "Could not share the update");
        }
      })
      .finally(() => {
        button.disabled = false;
      });
  });

  append(panel, heading, explanation, label, note, button);
  content.append(panel);
  return handle;
}
