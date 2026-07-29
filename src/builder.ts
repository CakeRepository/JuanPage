import { builderPath, docsUrl, getAppBasePath } from "./encoding/fragment.js";
import {
  buildShareUrl,
  compressDocument,
  measureSizes,
} from "./encoding/pipeline.js";
import { groceryPlan } from "./examples/grocery-plan.js";
import { append, el } from "./rendering/dom.js";
import { renderDocument, renderError } from "./rendering/render.js";
import {
  DocumentValidationError,
  validateDocument,
  type JuanPagerDocument,
} from "./schema/document.js";
import { PayloadLimitError } from "./encoding/pipeline.js";

function pretty(doc: JuanPagerDocument): string {
  return JSON.stringify(doc, null, 2);
}

function mountBuilder(): void {
  const host = document.getElementById("builder-app");
  if (!host) return;

  const shell = el("div", { className: "builder-shell" });
  const header = el("header", { className: "builder-header" });
  append(
    header,
    el("p", { className: "jp-brand", text: "JuanPager" }),
    el("h1", { text: "Page builder" }),
    el("p", {
      className: "jp-description",
      text: "Paste readable JuanPager JSON, validate it, preview it, and generate a shareable fragment URL.",
    }),
  );

  const layout = el("div", { className: "builder-layout" });
  const editorPane = el("section", { className: "builder-editor" });
  const previewPane = el("section", { className: "builder-preview" });

  const textarea = el("textarea", {
    className: "builder-textarea",
    attrs: {
      spellcheck: "false",
      "aria-label": "JuanPager JSON document",
    },
  }) as HTMLTextAreaElement;
  textarea.value = pretty(groceryPlan);

  const status = el("div", {
    className: "builder-status",
    attrs: { "aria-live": "polite" },
  });
  const sizes = el("p", { className: "builder-sizes", text: "Encoded: — · Decoded: —" });
  const linkOut = el("input", {
    className: "builder-link",
    attrs: {
      type: "text",
      readonly: true,
      "aria-label": "Generated JuanPager URL",
    },
  }) as HTMLInputElement;

  const actions = el("div", { className: "builder-actions" });

  const makeBtn = (label: string, className: string, onClick: () => void): HTMLButtonElement => {
    const button = el("button", {
      className,
      text: label,
      attrs: { type: "button" },
    });
    button.addEventListener("click", onClick);
    return button;
  };

  const setStatus = (message: string, isError = false): void => {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  };

  const parseEditor = (): JuanPagerDocument => {
    let raw: unknown;
    try {
      raw = JSON.parse(textarea.value);
    } catch (error) {
      throw new DocumentValidationError(
        "JSON parse failed.",
        error instanceof Error ? error.message : String(error),
      );
    }
    return validateDocument(raw);
  };

  const mobileFrame = el("div", {
    className: "builder-frame builder-frame-mobile",
    attrs: { "aria-label": "Mobile preview" },
  });
  const desktopFrame = el("div", {
    className: "builder-frame builder-frame-desktop",
    attrs: { "aria-label": "Desktop preview" },
  });

  const previewDoc = (doc: JuanPagerDocument): void => {
    renderDocument(doc, mobileFrame);
    renderDocument(doc, desktopFrame);
  };

  const validateOnly = (): void => {
    try {
      parseEditor();
      setStatus("Document is valid.");
    } catch (error) {
      const details =
        error instanceof DocumentValidationError
          ? error.details
          : error instanceof Error
            ? error.message
            : String(error);
      setStatus(`Validation failed.\n${details}`, true);
    }
  };

  const preview = (): void => {
    try {
      const doc = parseEditor();
      previewDoc(doc);
      setStatus("Preview updated.");
    } catch (error) {
      const title = error instanceof Error ? error.message : "Preview failed";
      const details =
        error instanceof DocumentValidationError ? error.details : undefined;
      renderError(mobileFrame, {
        title,
        explanation: "Fix validation errors, then preview again.",
        details,
        onDemo: () => {
          textarea.value = pretty(groceryPlan);
          previewDoc(groceryPlan);
        },
        onClear: () => mobileFrame.replaceChildren(),
        docsHref: docsUrl(),
      });
      desktopFrame.replaceChildren();
      setStatus(title, true);
    }
  };

  const generate = async (): Promise<void> => {
    try {
      const doc = parseEditor();
      const encoded = await compressDocument(doc);
      const decodedJson = JSON.stringify(doc);
      const { encodedBytes, decodedBytes } = measureSizes(encoded, decodedJson);
      sizes.textContent = `Encoded: ${encodedBytes.toLocaleString()} B / 16 KB · Decoded: ${decodedBytes.toLocaleString()} B / 64 KB`;

      const base =
        `${window.location.origin}${getAppBasePath()}`.replace(/\/+$/, "/") ||
        `${window.location.origin}/`;
      const url = await buildShareUrl(doc, base);
      linkOut.value = url;
      setStatus("Shareable link generated.");
      previewDoc(doc);
    } catch (error) {
      const message =
        error instanceof PayloadLimitError || error instanceof DocumentValidationError
          ? `${error.message}\n${"details" in error ? error.details : ""}`
          : error instanceof Error
            ? error.message
            : String(error);
      setStatus(message.trim(), true);
    }
  };

  const copyLink = async (): Promise<void> => {
    if (!linkOut.value) {
      setStatus("Generate a link first.", true);
      return;
    }
    await navigator.clipboard.writeText(linkOut.value);
    setStatus("Link copied to clipboard.");
  };

  const openLink = (): void => {
    if (!linkOut.value) {
      setStatus("Generate a link first.", true);
      return;
    }
    window.open(linkOut.value, "_blank", "noopener,noreferrer");
  };

  append(
    actions,
    makeBtn("Load grocery example", "jp-btn jp-btn-secondary", () => {
      textarea.value = pretty(groceryPlan);
      setStatus("Grocery example loaded.");
      previewDoc(groceryPlan);
    }),
    makeBtn("Validate", "jp-btn jp-btn-secondary", validateOnly),
    makeBtn("Preview", "jp-btn jp-btn-secondary", preview),
    makeBtn("Generate link", "jp-btn jp-btn-primary", () => {
      void generate();
    }),
    makeBtn("Copy link", "jp-btn jp-btn-primary", () => {
      void copyLink();
    }),
    makeBtn("Open link", "jp-btn jp-btn-secondary", openLink),
  );

  append(editorPane, el("h2", { text: "Document JSON" }), textarea, actions, sizes, linkOut, status);

  const previewHeader = el("div", { className: "builder-preview-header" });
  append(
    previewHeader,
    el("h2", { text: "Live preview" }),
    el("a", {
      className: "jp-link",
      text: "Docs",
      attrs: { href: docsUrl(), target: "_blank", rel: "noopener noreferrer" },
    }),
    el("a", {
      className: "jp-link",
      text: "Viewer",
      attrs: { href: getAppBasePath() },
    }),
  );

  const frames = el("div", { className: "builder-frames" });
  append(
    frames,
    el("h3", { text: "Mobile" }),
    mobileFrame,
    el("h3", { text: "Desktop" }),
    desktopFrame,
  );
  append(previewPane, previewHeader, frames);

  append(layout, editorPane, previewPane);
  append(shell, header, layout);
  append(
    shell,
    el("p", {
      className: "jp-privacy",
      text: `Builder path: ${builderPath()}. Generated links embed the full page in the URL fragment — never include secrets.`,
    }),
  );
  host.replaceChildren(shell);
  previewDoc(groceryPlan);
}

mountBuilder();
