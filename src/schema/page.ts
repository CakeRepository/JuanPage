import { z } from "zod";
import { DocumentValidationError } from "./document.js";
import { LIMITS } from "./limits.js";
import { isAllowedUrl } from "./url.js";

const text = (max: number = LIMITS.maxTextLength) => z.string().min(1).max(max);
const optionalText = (max: number = LIMITS.maxTextLength) => z.string().max(max).optional();
const id = z.string().min(1).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const key = z.string().min(1).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

const safeUrl = z.string().max(LIMITS.maxUrlLength).refine((value) => isAllowedUrl(value), {
  message: "URL must be https (or localhost during development)",
});

export const pageScalarSchema = z.union([
  z.string().max(LIMITS.maxTextLength),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
export const pageValueSchema = z.union([pageScalarSchema, z.array(pageScalarSchema).max(50)]);

export const pageFieldSchema = z.object({
  key,
  label: optionalText(100),
  value: pageValueSchema,
  format: z.enum(["auto","text","number","currency","percent","date","datetime","duration","url","email","phone","code"]).optional(),
  currency: z.string().min(3).max(8).optional(),
  display: z.enum(["auto","prominent","detail","hidden"]).optional(),
}).strict();

export const pageObjectSchema = z.object({
  id,
  type: text(80),
  name: text(200),
  summary: optionalText(600),
  group: optionalText(120),
  status: optionalText(80),
  tone: z.enum(["neutral","info","success","warning","danger"]).optional(),
  imageUrl: safeUrl.optional(),
  url: safeUrl.optional(),
  tags: z.array(text(40)).max(LIMITS.maxBadges).optional(),
  fields: z.array(pageFieldSchema).max(50).optional(),
  actionIds: z.array(id).max(30).optional(),
}).strict();

const actionBase = {
  id,
  label: text(100),
  description: optionalText(300),
  tone: z.enum(["neutral","primary","success","warning","danger"]).optional(),
};
const target = z.union([id, z.literal("page")]);

const toggleActionSchema = z.object({ ...actionBase, kind: z.literal("toggle"), target, field: key, initial: z.boolean().optional() }).strict();
const numberActionSchema = z.object({ ...actionBase, kind: z.literal("number"), target, field: key, initial: z.number().finite().optional(), min: z.number().finite().optional(), max: z.number().finite().optional(), step: z.number().finite().positive().optional() }).strict();
const choiceActionSchema = z.object({ ...actionBase, kind: z.literal("choice"), target, field: key, initial: z.string().max(200).optional(), options: z.array(z.object({ label: text(100), value: z.string().max(200) }).strict()).min(2).max(30) }).strict();
const textActionSchema = z.object({ ...actionBase, kind: z.literal("text"), target, field: key, initial: z.string().max(LIMITS.maxTextLength).optional(), placeholder: optionalText(160), multiline: z.boolean().optional() }).strict();
const openActionSchema = z.object({ ...actionBase, kind: z.literal("open"), url: safeUrl }).strict();
const copyActionSchema = z.object({ ...actionBase, kind: z.literal("copy"), source: z.enum(["page","object","field","url"]), target: target.optional(), field: key.optional() }).strict();
const emitActionSchema = z.object({ ...actionBase, kind: z.literal("emit"), includeObjectIds: z.array(id).max(100).optional() }).strict();

export const pageActionSchema = z.discriminatedUnion("kind", [toggleActionSchema, numberActionSchema, choiceActionSchema, textActionSchema, openActionSchema, copyActionSchema, emitActionSchema]);
export const pageRelationSchema = z.object({ from: id, to: id, kind: text(80), label: optionalText(160) }).strict();
const filterSchema = z.object({ field: key, equals: pageScalarSchema }).strict();
const metricBase = { id, label: text(100), format: z.enum(["auto","number","currency","percent"]).optional(), currency: z.string().min(3).max(8).optional() };
export const pageMetricSchema = z.discriminatedUnion("operation", [
  z.object({ ...metricBase, operation: z.literal("value"), value: pageScalarSchema }).strict(),
  z.object({ ...metricBase, operation: z.literal("count"), filter: filterSchema.optional() }).strict(),
  z.object({ ...metricBase, operation: z.literal("sum"), field: key, filter: filterSchema.optional() }).strict(),
  z.object({ ...metricBase, operation: z.literal("sum-product"), leftField: key, rightField: key, filter: filterSchema.optional() }).strict(),
  z.object({ ...metricBase, operation: z.literal("progress"), field: key, filter: filterSchema.optional() }).strict(),
]);

export const juanPageSchema = z.object({
  version: z.literal("1.0"),
  title: text(200),
  description: optionalText(1000),
  intent: optionalText(200),
  theme: z.enum(["system","light","dark"]).optional(),
  objects: z.array(pageObjectSchema).min(1).max(LIMITS.maxComponents),
  relations: z.array(pageRelationSchema).max(500).optional(),
  actions: z.array(pageActionSchema).max(LIMITS.maxComponents).optional(),
  metrics: z.array(pageMetricSchema).max(LIMITS.maxSummaryItems).optional(),
  view: z.object({ defaultLens: z.enum(["cards","table","flow"]).optional(), groupBy: z.enum(["group","type","status","none"]).optional(), density: z.enum(["comfortable","compact"]).optional() }).strict().optional(),
  metadata: z.record(pageScalarSchema).optional().refine((value) => !value || Object.keys(value).length <= LIMITS.maxMetadataEntries, { message: `metadata may have at most ${LIMITS.maxMetadataEntries} entries` }),
}).strict();

export type PageScalar = z.infer<typeof pageScalarSchema>;
export type PageValue = z.infer<typeof pageValueSchema>;
export type PageField = z.infer<typeof pageFieldSchema>;
export type PageObject = z.infer<typeof pageObjectSchema>;
export type PageAction = z.infer<typeof pageActionSchema>;
export type PageRelation = z.infer<typeof pageRelationSchema>;
export type PageMetric = z.infer<typeof pageMetricSchema>;
export type JuanPageDocument = z.infer<typeof juanPageSchema>;
export type PageLens = NonNullable<JuanPageDocument["view"]>["defaultLens"];

export function validatePage(input: unknown): JuanPageDocument {
  const parsed = juanPageSchema.safeParse(input);
  if (!parsed.success) {
    throw new DocumentValidationError("This JuanPage is invalid.", parsed.error.issues.slice(0, 30).map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("\n"));
  }
  const page = parsed.data;
  const objectIds = new Set<string>();
  for (const object of page.objects) {
    if (objectIds.has(object.id)) throw new DocumentValidationError("This JuanPage is invalid.", `Duplicate object id "${object.id}".`);
    objectIds.add(object.id);
    const fieldKeys = new Set<string>();
    for (const field of object.fields ?? []) {
      if (fieldKeys.has(field.key)) throw new DocumentValidationError("This JuanPage is invalid.", `Object "${object.id}" has duplicate field key "${field.key}".`);
      fieldKeys.add(field.key);
    }
  }
  const actionIds = new Set<string>();
  for (const action of page.actions ?? []) {
    if (actionIds.has(action.id)) throw new DocumentValidationError("This JuanPage is invalid.", `Duplicate action id "${action.id}".`);
    actionIds.add(action.id);
    if ("target" in action && action.target && action.target !== "page" && !objectIds.has(action.target)) throw new DocumentValidationError("This JuanPage is invalid.", `Action "${action.id}" targets unknown object "${action.target}".`);
    if (action.kind === "copy" && action.source === "field" && (!action.target || !action.field)) throw new DocumentValidationError("This JuanPage is invalid.", `Copy action "${action.id}" needs both target and field when source is "field".`);
  }
  for (const object of page.objects) for (const actionId of object.actionIds ?? []) if (!actionIds.has(actionId)) throw new DocumentValidationError("This JuanPage is invalid.", `Object "${object.id}" references unknown action "${actionId}".`);
  for (const relation of page.relations ?? []) if (!objectIds.has(relation.from) || !objectIds.has(relation.to)) throw new DocumentValidationError("This JuanPage is invalid.", `Relation "${relation.from}" -> "${relation.to}" references an unknown object.`);
  return page;
}

export function pageObject(page: JuanPageDocument, objectId: string): PageObject | undefined { return page.objects.find((object) => object.id === objectId); }
export function objectField(object: PageObject, fieldKey: string): PageField | undefined { return object.fields?.find((field) => field.key === fieldKey); }
export function humanizeKey(value: string): string { return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[._:-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
