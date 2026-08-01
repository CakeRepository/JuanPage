import type { PageField, PageObject, PageValue } from "../schema/page.js";

export type SurfaceForm = "hero" | "stat" | "media" | "document" | "activity" | "control" | "record";
export type SurfaceSpan = "compact" | "standard" | "wide" | "full";
export type SurfaceDensity = "calm" | "normal" | "dense";
export type GroupFlow = "spotlight" | "metrics" | "stream" | "ledger" | "mosaic";

export type ObjectComposition = Readonly<{
  form: SurfaceForm;
  span: SurfaceSpan;
  density: SurfaceDensity;
  exposeDetails: boolean;
}>;

export type GroupComposition = Readonly<{
  flow: GroupFlow;
  density: SurfaceDensity;
}>;

export type ObjectCompositionContext = Readonly<{
  groupIndex: number;
  indexInGroup: number;
  groupSize: number;
  interactive: boolean;
  editable: boolean;
}>;

function isNumber(value: PageValue): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function isLongText(value: PageValue): boolean {
  return typeof value === "string" && (value.length > 180 || value.includes("\n"));
}

function semanticTag(value: PageValue): string | undefined {
  return Array.isArray(value) && typeof value[0] === "string" && value[0].startsWith("$") ? value[0] : undefined;
}

function visibleFields(object: PageObject): PageField[] {
  return (object.fields ?? []).filter((field) => field.display !== "hidden");
}

function typeWords(object: PageObject): Set<string> {
  return new Set(object.type.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}

function includesAny(words: ReadonlySet<string>, candidates: readonly string[]): boolean {
  return candidates.some((candidate) => words.has(candidate));
}

export function composeObject(object: PageObject, context: ObjectCompositionContext): ObjectComposition {
  const fields = visibleFields(object);
  const words = typeWords(object);
  const prominent = fields.filter((field) => field.display === "prominent");
  const numericProminent = prominent.filter((field) => isNumber(field.value));
  const hasMedia = Boolean(object.imageUrl)
    || fields.some((field) => ["$media", "$geometry", "$path"].includes(semanticTag(field.value) ?? ""));
  const hasDocument = fields.some((field) => field.format === "code" || isLongText(field.value)
    || ["$content", "$range"].includes(semanticTag(field.value) ?? ""));
  const activityLike = includesAny(words, ["activity", "event", "message", "notification", "log", "change", "release"]);
  const controlLike = includesAny(words, ["control", "decision", "approval", "command"])
    || (context.editable && fields.length <= 5);
  const heroLike = context.groupIndex === 0
    && context.indexInGroup === 0
    && context.groupSize <= 2
    && Boolean(object.summary)
    && (object.summary?.length ?? 0) >= 70;

  let form: SurfaceForm = "record";
  if (hasMedia) form = "media";
  else if (hasDocument) form = "document";
  else if (numericProminent.length && numericProminent.length >= Math.max(1, prominent.length - 1) && fields.length <= 5) form = "stat";
  else if (activityLike) form = "activity";
  else if (controlLike) form = "control";
  else if (heroLike) form = "hero";

  let span: SurfaceSpan = "standard";
  if (form === "hero") span = "full";
  else if (form === "media" || form === "document") span = context.groupSize <= 2 ? "full" : "wide";
  else if (form === "stat") span = "compact";
  else if (fields.length >= 8) span = "wide";

  const density: SurfaceDensity = form === "hero" || form === "media" || form === "document"
    ? "calm"
    : fields.length > 7
      ? "dense"
      : "normal";

  return {
    form,
    span,
    density,
    exposeDetails: form === "document" || form === "activity" || form === "record" || fields.length <= 4,
  };
}

export function composeGroup(objects: readonly PageObject[], groupIndex: number, interactiveIds: ReadonlySet<string> = new Set()): GroupComposition {
  const plans = objects.map((object, index) => composeObject(object, {
    groupIndex,
    indexInGroup: index,
    groupSize: objects.length,
    interactive: interactiveIds.has(object.id),
    editable: false,
  }));
  if (plans.some((plan) => plan.form === "hero" || plan.span === "full")) return { flow: "spotlight", density: "calm" };
  if (plans.length && plans.every((plan) => plan.form === "stat")) return { flow: "metrics", density: "normal" };
  if (plans.filter((plan) => plan.form === "activity").length >= Math.ceil(plans.length / 2)) return { flow: "stream", density: "dense" };
  if (objects.length >= 7 || plans.filter((plan) => plan.density === "dense").length >= Math.ceil(plans.length / 2)) {
    return { flow: "ledger", density: "dense" };
  }
  return { flow: "mosaic", density: "normal" };
}
