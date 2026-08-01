import type { GroupFlow, SurfaceDensity, SurfaceForm, SurfaceSpan } from "./composePage.js";

const ACTIVITY_WORDS = new Set(["activity", "event", "message", "notification", "log", "change", "release"]);
const CONTROL_WORDS = new Set(["control", "decision", "approval", "command"]);

function words(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}

function hasAny(source: ReadonlySet<string>, candidates: ReadonlySet<string>): boolean {
  return [...candidates].some((candidate) => source.has(candidate));
}

function numericProminent(card: HTMLElement): boolean {
  const value = card.querySelector(".jp-u-prominent")?.textContent?.trim() ?? "";
  return Boolean(value) && /^[$€£¥]?[\d,.]+(?:\s*%|\s*[a-z-]+)?$/i.test(value);
}

function inferCard(card: HTMLElement, index: number, size: number): { form: SurfaceForm; span: SurfaceSpan; density: SurfaceDensity } {
  const type = words(card.querySelector(".jp-u-type")?.textContent ?? "");
  const summary = card.querySelector(".jp-u-summary")?.textContent?.trim() ?? "";
  const controls = card.querySelectorAll("button,input,select,textarea").length;
  const hasMedia = Boolean(card.querySelector("img,.jp-u-image-wrap"));
  const hasDocument = Boolean(card.querySelector("pre,code,.jp-u-document-content")) || summary.length > 240;
  const activity = hasAny(type, ACTIVITY_WORDS);
  const control = hasAny(type, CONTROL_WORDS) || controls >= 2;
  const hero = index === 0 && size <= 2 && summary.length >= 70;

  let form: SurfaceForm = "record";
  if (hasMedia) form = "media";
  else if (hasDocument) form = "document";
  else if (numericProminent(card)) form = "stat";
  else if (activity) form = "activity";
  else if (control) form = "control";
  else if (hero) form = "hero";

  const span: SurfaceSpan = form === "hero" ? "full"
    : form === "media" || form === "document" ? (size <= 2 ? "full" : "wide")
      : form === "stat" ? "compact" : "standard";
  const density: SurfaceDensity = form === "hero" || form === "media" || form === "document"
    ? "calm" : card.textContent && card.textContent.length > 650 ? "dense" : "normal";
  return { form, span, density };
}

function inferGroup(forms: readonly SurfaceForm[], cards: readonly HTMLElement[]): { flow: GroupFlow; density: SurfaceDensity } {
  if (forms.some((form) => form === "hero" || form === "media" || form === "document")) return { flow: "spotlight", density: "calm" };
  if (forms.length && forms.every((form) => form === "stat")) return { flow: "metrics", density: "normal" };
  if (forms.filter((form) => form === "activity").length >= Math.ceil(forms.length / 2)) return { flow: "stream", density: "dense" };
  if (cards.length >= 7 || cards.some((card) => card.textContent && card.textContent.length > 650)) return { flow: "ledger", density: "dense" };
  return { flow: "mosaic", density: "normal" };
}

export function enhanceAdaptiveComposition(root: ParentNode = document): void {
  for (const group of root.querySelectorAll<HTMLElement>(".jp-u-group")) {
    const cards = [...group.querySelectorAll<HTMLElement>(":scope .jp-u-grid > .jp-u-card")];
    const forms: SurfaceForm[] = [];
    cards.forEach((card, index) => {
      const plan = inferCard(card, index, cards.length);
      card.dataset.surfaceForm = plan.form;
      card.dataset.surfaceSpan = plan.span;
      card.dataset.surfaceDensity = plan.density;
      forms.push(plan.form);
    });
    const groupPlan = inferGroup(forms, cards);
    group.dataset.groupFlow = groupPlan.flow;
    group.dataset.groupDensity = groupPlan.density;
    group.classList.remove("is-spotlight", "is-metrics", "is-stream", "is-ledger", "is-mosaic");
    group.classList.add(`is-${groupPlan.flow}`);
  }
}

function start(): void {
  let queued = false;
  const apply = (): void => {
    queued = false;
    enhanceAdaptiveComposition(document);
  };
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(apply);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  apply();
}

if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") start();
