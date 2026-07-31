import { getAppBasePath } from "./encoding/fragment.js";
import {
  buildMeaningShareUrl,
  buildPageShareUrl,
  encodeMeaningPacket,
  encodePage,
  measurePageSizes,
  PagePayloadError,
  type PagePayloadEncoding,
} from "./encoding/pagePipeline.js";
import { futureMeaningPacket } from "./examples/meaning-workspace.js";
import { materializeMeaningPacket, validateMeaningPacket, type MeaningPacket } from "./protocol/meaning.js";
import { append, el } from "./rendering/dom.js";
import { renderPage } from "./rendering/renderPage.js";
import { DocumentValidationError } from "./schema/errors.js";
import { validatePage, type JuanPageDocument } from "./schema/page.js";

const mount = document.getElementById("builder-app");

type ParsedSource = { page: JuanPageDocument; packet?: MeaningPacket };

if (mount) {
  const root = el("div", { className: "jp-b-root" });
  const header = el("header", { className: "jp-b-header" });
  const copy = el("div");
  append(
    copy,
    el("p", { className: "jp-b-kicker", text: "JUAN / BUILDER" }),
    el("h1", { text: "Describe meaning. Get an interface." }),
    el("p", { text: "Paste an M1 symbolic packet or a canonical JuanPage 1.0 graph. Both use the same trusted runtime." }),
  );
  append(header, copy, el("a", { className: "jp-u-button", text: "Open viewer", attrs: { href: getAppBasePath() } }));

  const layout = el("div", { className: "jp-b-layout" });
  const editorPanel = el("section", { className: "jp-b-panel" });
  append(editorPanel, el("div", { className: "jp-b-panel-head", text: "1 · M1 packet or JuanPage 1.0" }));
  const tools = el("div", { className: "jp-b-tools" });
  const load = el("button", { className: "jp-u-button", text: "Load M1 trust demo", attrs: { type: "button" } });
  const format = el("button", { className: "jp-u-button", text: "Format JSON", attrs: { type: "button" } });
  const encoding = el("select", { attrs: { "aria-label": "Encoding" } }) as HTMLSelectElement;
  append(
    encoding,
    el("option", { text: "Gzip · compact link", attrs: { value: "gz" } }),
    el("option", { text: "Raw · inspectable", attrs: { value: "raw" } }),
  );
  append(tools, load, format, encoding);

  const editor = el("textarea", { className: "jp-b-editor", attrs: { spellcheck: "false", "aria-label": "M1 or JuanPage JSON" } }) as HTMLTextAreaElement;
  editor.value = JSON.stringify(futureMeaningPacket, null, 2);
  const status = el("div", { className: "jp-b-status", attrs: { "aria-live": "polite" } });
  const statusTitle = el("strong");
  const statusDetail = el("span");
  append(status, statusTitle, statusDetail);

  const share = el("div", { className: "jp-b-share" });
  const generate = el("button", { className: "jp-u-button jp-u-primary", text: "Generate share link", attrs: { type: "button" } });
  const shareUrl = el("input", { attrs: { type: "url", readonly: true, placeholder: "Validated link appears here" } }) as HTMLInputElement;
  const copyLink = el("button", { className: "jp-u-button", text: "Copy", attrs: { type: "button", disabled: true } }) as HTMLButtonElement;
  const openLink = el("a", { className: "jp-u-button is-disabled", text: "Open", attrs: { target: "_blank", rel: "noopener noreferrer", "aria-disabled": "true" } });
  append(share, generate, shareUrl, copyLink, openLink);
  append(editorPanel, tools, editor, status, share);

  const previewPanel = el("section", { className: "jp-b-panel" });
  append(previewPanel, el("div", { className: "jp-b-panel-head", text: "2 · Live universal workspace" }));
  const previewFrame = el("div", { className: "jp-b-preview-frame" });
  const preview = el("div", { className: "jp-b-preview" });
  append(previewFrame, preview);
  append(previewPanel, previewFrame);
  append(layout, editorPanel, previewPanel);
  append(root, header, layout);
  mount.replaceChildren(root);

  const parse = (): ParsedSource => {
    let raw: unknown;
    try {
      raw = JSON.parse(editor.value);
    } catch (error) {
      throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (Array.isArray(raw) && raw[0] === 1) {
      const packet = validateMeaningPacket(raw);
      return { packet, page: materializeMeaningPacket(packet) };
    }
    if (raw && typeof raw === "object" && "transport" in raw && (raw as { transport?: unknown }).transport === "m1") {
      const packet = validateMeaningPacket((raw as { packet?: unknown }).packet);
      return { packet, page: materializeMeaningPacket(packet) };
    }
    return { page: validatePage(raw) };
  };

  const detail = (error: unknown): string =>
    error instanceof DocumentValidationError || error instanceof PagePayloadError
      ? error.details
      : error instanceof Error
        ? error.message
        : String(error);

  const show = (ok: boolean, title: string, text: string): void => {
    status.classList.toggle("is-valid", ok);
    status.classList.toggle("is-error", !ok);
    statusTitle.textContent = title;
    statusDetail.textContent = text;
  };

  const update = (): void => {
    try {
      const source = parse();
      renderPage(source.page, preview);
      show(
        true,
        source.packet ? "Valid M1 packet" : "Valid JuanPage 1.0",
        `${source.page.objects.length} objects · ${source.page.relations?.length ?? 0} relationships · one renderer`,
      );
    } catch (error) {
      preview.replaceChildren(el("pre", { className: "jp-b-preview-error", text: detail(error) }));
      show(false, "Not valid yet", detail(error));
    }
  };

  let timer = 0;
  editor.addEventListener("input", () => { clearTimeout(timer); timer = window.setTimeout(update, 180); });
  load.addEventListener("click", () => { editor.value = JSON.stringify(futureMeaningPacket, null, 2); update(); });
  format.addEventListener("click", () => {
    try {
      editor.value = JSON.stringify(JSON.parse(editor.value), null, 2);
      update();
    } catch (error) {
      show(false, "Cannot format", detail(error));
    }
  });

  generate.addEventListener("click", () => {
    void (async () => {
      try {
        const source = parse();
        const selected = encoding.value as PagePayloadEncoding;
        const base = new URL(getAppBasePath(), window.location.origin).toString();
        const payload = source.packet
          ? await encodeMeaningPacket(source.packet, selected)
          : await encodePage(source.page, selected);
        const url = source.packet
          ? await buildMeaningShareUrl(source.packet, base, selected)
          : await buildPageShareUrl(source.page, base, selected);
        const sizes = measurePageSizes(payload, editor.value);
        shareUrl.value = url;
        copyLink.disabled = false;
        openLink.classList.remove("is-disabled");
        openLink.setAttribute("href", url);
        openLink.setAttribute("aria-disabled", "false");
        show(true, "Share link ready", `${sizes.encodedBytes.toLocaleString()} encoded bytes · ${sizes.decodedBytes.toLocaleString()} source bytes`);
      } catch (error) {
        show(false, "Could not generate link", detail(error));
      }
    })();
  });

  copyLink.addEventListener("click", () => {
    if (shareUrl.value) void navigator.clipboard.writeText(shareUrl.value).then(() => show(true, "Copied", "The JuanPager link is on your clipboard."));
  });
  update();
}
