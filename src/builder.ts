import { compileJuanDialect, DialectError } from "./dialect/juan.js";
import { builderPath, docsUrl, getAppBasePath } from "./encoding/fragment.js";
import {
  buildShareUrl,
  encodeMoment,
  compressDocument,
  measureSizes,
  PayloadLimitError,
  type PayloadEncoding,
} from "./encoding/pipeline.js";
import { groceryCheckout, groceryCheckoutDialect } from "./examples/grocery-checkout.js";
import { groceryPlan } from "./examples/grocery-plan.js";
import { append, el } from "./rendering/dom.js";
import { renderDocument, renderError } from "./rendering/render.js";
import { renderMoment } from "./rendering/renderMoment.js";
import { validateAnyDocument, type LoadedDocument } from "./schema/anyDocument.js";
import { DocumentValidationError } from "./schema/document.js";

type BuilderMode = "moment" | "dialect" | "legacy";

const MODES: Array<{ id: BuilderMode; label: string; hint: string }> = [
  {
    id: "moment",
    label: "Moment JSON (0.2)",
    hint: "Intent + facts + affordances. The app composes the interface.",
  },
  {
    id: "dialect",
    label: "Juan dialect",
    hint: "Paste agent-friendly text. It compiles to a 0.2 moment.",
  },
  {
    id: "legacy",
    label: "Document JSON (0.1)",
    hint: "The original component-tree format. Still fully supported.",
  },
];

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function errorDetails(error: unknown): string | undefined {
  if (error instanceof DocumentValidationError || error instanceof PayloadLimitError) {
    return error.details;
  }
  if (error instanceof DialectError) return error.details;
  return error instanceof Error ? error.message : undefined;
}

function mountBuilder(): void {
  const host = document.getElementById("builder-app");
  if (!host) return;

  let mode: BuilderMode = "moment";
  let encoding: PayloadEncoding = "gz";

  const sources: Record<BuilderMode, string> = {
    moment: pretty(groceryCheckout),
    dialect: groceryCheckoutDialect,
    legacy: pretty(groceryPlan),
  };

  const shell = el("div", { className: "builder-shell" });
  const header = el("header", { className: "builder-header" });
  append(
    header,
    el("p", { className: "jp-brand", text: "JuanPager" }),
    el("h1", { text: "Page builder" }),
    el("p", {
      className: "jp-description",
      text: "Write a moment, compile the Juan dialect, or paste a 0.1 document. Validate it, preview it, and generate a shareable fragment URL.",
    }),
  );

  const layout = el("div", { className: "builder-layout" });
  const editorPane = el("section", { className: "builder-editor" });
  const previewPane = el("section", { className: "builder-preview" });

  const tabs = el("div", { className: "builder-tabs", attrs: { role: "tablist" } });
  const hint = el("p", { className: "builder-hint" });

  const textarea = el("textarea", {
    className: "builder-textarea",
    attrs: {
      spellcheck: "false",
      "aria-label": "JuanPager source",
    },
  }) as HTMLTextAreaElement;

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

  const mobileFrame = el("div", {
    className: "builder-frame builder-frame-mobile",
    attrs: { "aria-label": "Mobile preview" },
  });
  const desktopFrame = el("div", {
    className: "builder-frame builder-frame-desktop",
    attrs: { "aria-label": "Desktop preview" },
  });

  const parseEditor = (): LoadedDocument => {
    const raw = textarea.value;

    if (mode === "dialect") {
      return { kind: "moment", document: compileJuanDialect(raw) };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new DocumentValidationError(
        "JSON parse failed.",
        error instanceof Error ? error.message : String(error),
      );
    }
    return validateAnyDocument(parsed);
  };

  const previewLoaded = (loaded: LoadedDocument): void => {
    for (const frame of [mobileFrame, desktopFrame]) {
      if (loaded.kind === "moment") renderMoment(loaded.document, frame);
      else renderDocument(loaded.document, frame);
    }
  };

  const loadSource = (next: BuilderMode, text: string, message: string): void => {
    sources[next] = text;
    setMode(next);
    setStatus(message);
    try {
      previewLoaded(parseEditor());
    } catch {
      // Preview stays as-is; Validate reports the problem.
    }
  };

  const validateOnly = (): void => {
    try {
      const loaded = parseEditor();
      const label =
        loaded.kind === "moment"
          ? `Valid moment (${loaded.document.moment}, ${loaded.document.entities.length} entities).`
          : `Valid 0.1 document (${loaded.document.components.length} top-level components).`;
      setStatus(label);
    } catch (error) {
      setStatus(`Validation failed.\n${errorDetails(error) ?? String(error)}`, true);
    }
  };

  const preview = (): void => {
    try {
      previewLoaded(parseEditor());
      setStatus("Preview updated.");
    } catch (error) {
      const title = error instanceof Error ? error.message : "Preview failed";
      renderError(mobileFrame, {
        title,
        explanation: "Fix the errors below, then preview again.",
        details: errorDetails(error),
        onDemo: () => {
          loadSource("moment", pretty(groceryCheckout), "Grocery checkout loaded.");
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
      const loaded = parseEditor();
      const encoded =
        loaded.kind === "moment"
          ? await encodeMoment(loaded.document, encoding)
          : await compressDocument(loaded.document);
      const decodedJson = JSON.stringify(loaded.document);
      const { encodedBytes, decodedBytes } = measureSizes(encoded, decodedJson);
      sizes.textContent = `Encoded: ${encodedBytes.toLocaleString()} B / 16 KB · Decoded: ${decodedBytes.toLocaleString()} B / 64 KB`;

      const base =
        `${window.location.origin}${getAppBasePath()}`.replace(/\/+$/, "/") ||
        `${window.location.origin}/`;
      linkOut.value = await buildShareUrl(loaded.document, base, { encoding });
      setStatus(
        loaded.kind === "moment"
          ? `Shareable moment link generated (enc=${encoding}).`
          : "Shareable 0.1 link generated (gzip).",
      );
      previewLoaded(loaded);
    } catch (error) {
      const message =
        error instanceof Error
          ? `${error.message}\n${errorDetails(error) ?? ""}`
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

  const tabButtons = new Map<BuilderMode, HTMLButtonElement>();

  function setMode(next: BuilderMode): void {
    sources[mode] = textarea.value;
    mode = next;
    textarea.value = sources[next];
    hint.textContent = MODES.find((entry) => entry.id === next)!.hint;
    for (const [id, button] of tabButtons) {
      const active = id === next;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    }
  }

  for (const entry of MODES) {
    const button = el("button", {
      className: "builder-tab",
      text: entry.label,
      attrs: { type: "button", role: "tab", "aria-selected": "false" },
    });
    button.addEventListener("click", () => setMode(entry.id));
    tabButtons.set(entry.id, button);
    append(tabs, button);
  }

  const encodingRow = el("div", { className: "builder-encoding" });
  append(encodingRow, el("span", { text: "Moment encoding:" }));
  for (const option of [
    { value: "gz" as const, label: "gzip (short links)" },
    { value: "raw" as const, label: "raw (readable, larger)" },
  ]) {
    const label = el("label");
    const radio = el("input", {
      attrs: { type: "radio", name: "builder-encoding", value: option.value },
    }) as HTMLInputElement;
    radio.checked = option.value === encoding;
    radio.addEventListener("change", () => {
      if (radio.checked) encoding = option.value;
    });
    append(label, radio, el("span", { text: option.label }));
    append(encodingRow, label);
  }

  append(
    actions,
    makeBtn("Load grocery checkout", "jp-btn jp-btn-secondary", () => {
      loadSource("moment", pretty(groceryCheckout), "Grocery checkout moment loaded.");
    }),
    makeBtn("Load dialect example", "jp-btn jp-btn-secondary", () => {
      loadSource("dialect", groceryCheckoutDialect, "Dialect example loaded.");
    }),
    makeBtn("Load 0.1 example", "jp-btn jp-btn-secondary", () => {
      loadSource("legacy", pretty(groceryPlan), "0.1 grocery plan loaded.");
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

  append(
    editorPane,
    el("h2", { text: "Source" }),
    tabs,
    hint,
    textarea,
    actions,
    encodingRow,
    sizes,
    linkOut,
    status,
  );

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

  setMode("moment");
  previewLoaded({ kind: "moment", document: groceryCheckout });
}

mountBuilder();
