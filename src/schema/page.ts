import { z } from "zod";
import { semanticProjectionSchema, type SemanticProjection } from "../projection/universal.js";
import { DocumentValidationError } from "./errors.js";
import { pageInteractionStateSchema } from "./interaction.js";
import { LIMITS } from "./limits.js";
import { isAllowedUrl } from "./url.js";
import { pageScalarSchema, pageValueSchema } from "./value.js";

export {
  pageScalarSchema,
  pageValueSchema,
  semanticValueSchema,
  isSemanticValue,
  formatSemanticValue,
  matrixValue,
  semanticValueTag,
  type PageScalar,
  type PageValue,
  type SemanticValue,
} from "./value.js";
export {
  pageClockStateSchema,
  pageInteractionDomainSchema,
  pageInteractionStateSchema,
  pageInteractionValueSchema,
  pageViewportStateSchema,
  type PageClockState,
  type PageInteractionDomain,
  type PageInteractionState,
  type PageInteractionValue,
  type PageViewportState,
} from "./interaction.js";
export {
  semanticProjectionSchema,
  validateSemanticProjection,
  evaluateSemanticProjection,
  type SemanticProjection,
  type SemanticProjectionResult,
} from "../projection/universal.js";

const text = (max: number = LIMITS.maxTextLength) => z.string().min(1).max(max);
const optionalText = (max: number = LIMITS.maxTextLength) => z.string().max(max).optional();
const id = z.string().min(1).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const key = z.string().min(1).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const safeUrl = z.string().max(LIMITS.maxUrlLength).refine(isAllowedUrl, {
  message: "URL must be https (or localhost during development)",
});

export const pageFieldSchema = z.object({
  key,
  label: optionalText(100),
  value: pageValueSchema,
  format: z.enum(["auto", "text", "number", "currency", "percent", "date", "datetime", "duration", "url", "email", "phone", "code"]).optional(),
  currency: z.string().min(3).max(8).optional(),
  display: z.enum(["auto", "prominent", "detail", "hidden"]).optional(),
}).strict();

export const pageObjectSchema = z.object({
  id,
  type: text(80),
  name: text(200),
  summary: optionalText(600),
  group: optionalText(120),
  status: optionalText(80),
  tone: z.enum(["neutral", "info", "success", "warning", "danger"]).optional(),
  imageUrl: safeUrl.optional(),
  tags: z.array(text(40)).max(LIMITS.maxBadges).optional(),
  fields: z.array(pageFieldSchema).max(50).optional(),
}).strict();

export const pageRelationSchema = z.object({
  id,
  from: id,
  to: id,
  kind: text(80),
  label: optionalText(160),
}).strict();

const filterSchema = z.object({ field: key, equals: pageScalarSchema }).strict();
const metricBase = {
  id,
  label: text(100),
  format: z.enum(["auto", "number", "currency", "percent"]).optional(),
  currency: z.string().min(3).max(8).optional(),
  ignoreScopes: z.array(id).max(20).optional(),
};
export const pageMetricSchema = z.discriminatedUnion("operation", [
  z.object({ ...metricBase, operation: z.literal("value"), value: pageScalarSchema }).strict(),
  z.object({ ...metricBase, operation: z.literal("count"), filter: filterSchema.optional() }).strict(),
  z.object({ ...metricBase, operation: z.literal("sum"), field: key, filter: filterSchema.optional() }).strict(),
  z.object({ ...metricBase, operation: z.literal("sum-product"), leftField: key, rightField: key, filter: filterSchema.optional() }).strict(),
  z.object({ ...metricBase, operation: z.literal("progress"), field: key, filter: filterSchema.optional() }).strict(),
]);

export const pageScopeSchema = z.object({
  id,
  label: text(100),
  field: key,
  initial: pageScalarSchema.optional(),
  objectTypes: z.array(text(80)).max(30).optional(),
}).strict();

const legacyProjectionBase = {
  id,
  label: text(120),
  description: optionalText(300),
  sourceType: optionalText(80),
  sourceGroup: optionalText(120),
  dimension: key,
  format: z.enum(["auto", "number", "currency", "percent"]).optional(),
  currency: z.string().min(3).max(8).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  limit: z.number().int().positive().max(50).optional(),
  ignoreScopes: z.array(id).max(20).optional(),
};
export const legacyPageProjectionSchema = z.discriminatedUnion("operation", [
  z.object({ ...legacyProjectionBase, operation: z.literal("count") }).strict(),
  z.object({ ...legacyProjectionBase, operation: z.literal("sum"), measure: key }).strict(),
  z.object({ ...legacyProjectionBase, operation: z.literal("average"), measure: key }).strict(),
]);
export const pageProjectionSchema = z.union([legacyPageProjectionSchema, semanticProjectionSchema]);

const inspectEffectSchema = z.object({ kind: z.literal("inspect") }).strict();
const setEffectSchema = z.object({ kind: z.literal("set"), field: key }).strict();
const scopeEffectSchema = z.object({ kind: z.literal("scope"), scope: id }).strict();
const selectEffectSchema = z.object({
  kind: z.literal("select"),
  selection: id,
  mode: z.enum(["single", "multiple"]),
}).strict();
const invokeEffectSchema = z.object({
  kind: z.literal("invoke"),
  operation: id,
  policy: z.enum(["allow", "approval"]),
}).strict();
const navigateEffectSchema = z.object({ kind: z.literal("navigate"), url: safeUrl }).strict();
const copyEffectSchema = z.object({
  kind: z.literal("copy"),
  source: z.enum(["page", "object", "field", "url"]),
  field: key.optional(),
  url: safeUrl.optional(),
}).strict();
export const pageAffordanceEffectSchema = z.discriminatedUnion("kind", [
  inspectEffectSchema,
  setEffectSchema,
  scopeEffectSchema,
  selectEffectSchema,
  invokeEffectSchema,
  navigateEffectSchema,
  copyEffectSchema,
]);

const noneInputSchema = z.object({ kind: z.literal("none") }).strict();
const booleanInputSchema = z.object({ kind: z.literal("boolean") }).strict();
const numberInputSchema = z.object({
  kind: z.literal("number"),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
  step: z.number().finite().positive().optional(),
  presentation: z.enum(["entry", "adjust"]).optional(),
}).strict();
const choiceInputSchema = z.object({
  kind: z.literal("choice"),
  options: z.array(z.object({ label: text(100), value: pageScalarSchema }).strict()).min(2).max(50),
}).strict();
const textInputSchema = z.object({
  kind: z.literal("text"),
  placeholder: optionalText(160),
  multiline: z.boolean().optional(),
}).strict();
export const pageAffordanceInputSchema = z.discriminatedUnion("kind", [
  noneInputSchema,
  booleanInputSchema,
  numberInputSchema,
  choiceInputSchema,
  textInputSchema,
]);

export const pageAffordanceSchema = z.object({
  id,
  label: text(100),
  description: optionalText(300),
  tone: z.enum(["neutral", "primary", "success", "warning", "danger"]).optional(),
  effect: pageAffordanceEffectSchema,
  input: pageAffordanceInputSchema,
}).strict();

export const pageBindingTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("page") }).strict(),
  z.object({ kind: z.literal("object"), object: id }).strict(),
  z.object({ kind: z.literal("field"), object: id, field: key }).strict(),
  z.object({ kind: z.literal("metric"), metric: id }).strict(),
  z.object({ kind: z.literal("relation"), relation: id }).strict(),
  z.object({ kind: z.literal("projection"), projection: id }).strict(),
]);

export const pageBindingSchema = z.object({
  id,
  target: pageBindingTargetSchema,
  affordance: id,
  value: pageScalarSchema.optional(),
  priority: z.enum(["primary", "secondary"]).optional(),
}).strict();

export const juanPageSchema = z.object({
  version: z.literal("2.0"),
  title: text(200),
  description: optionalText(1000),
  intent: optionalText(200),
  theme: z.enum(["system", "light", "dark"]).optional(),
  objects: z.array(pageObjectSchema).min(1).max(LIMITS.maxComponents),
  relations: z.array(pageRelationSchema).max(500).optional(),
  metrics: z.array(pageMetricSchema).max(LIMITS.maxSummaryItems).optional(),
  scopes: z.array(pageScopeSchema).max(30).optional(),
  projections: z.array(pageProjectionSchema).max(30).optional(),
  affordances: z.array(pageAffordanceSchema).max(LIMITS.maxComponents).optional(),
  bindings: z.array(pageBindingSchema).max(LIMITS.maxComponents * 2).optional(),
  state: pageInteractionStateSchema.optional(),
  metadata: z.record(pageScalarSchema).optional().refine(
    (value) => !value || Object.keys(value).length <= LIMITS.maxMetadataEntries,
    { message: `metadata may have at most ${LIMITS.maxMetadataEntries} entries` },
  ),
}).strict();

export type PageField = z.infer<typeof pageFieldSchema>;
export type PageObject = z.infer<typeof pageObjectSchema>;
export type PageRelation = z.infer<typeof pageRelationSchema>;
export type PageMetric = z.infer<typeof pageMetricSchema>;
export type PageScope = z.infer<typeof pageScopeSchema>;
export type LegacyPageProjection = z.infer<typeof legacyPageProjectionSchema>;
export type PageProjection = z.infer<typeof pageProjectionSchema>;
export type PageAffordanceEffect = z.infer<typeof pageAffordanceEffectSchema>;
export type PageAffordanceInput = z.infer<typeof pageAffordanceInputSchema>;
export type PageAffordance = z.infer<typeof pageAffordanceSchema>;
export type PageBindingTarget = z.infer<typeof pageBindingTargetSchema>;
export type PageBinding = z.infer<typeof pageBindingSchema>;
export type JuanPageDocument = z.infer<typeof juanPageSchema>;

function invalid(details: string): never {
  throw new DocumentValidationError("This JuanPage is invalid.", details);
}

function duplicate(set: Set<string>, value: string, kind: string): void {
  if (set.has(value)) invalid(`Duplicate ${kind} id "${value}".`);
  set.add(value);
}

function sourceObjects(page: JuanPageDocument, sourceType?: string, sourceGroup?: string): PageObject[] {
  return page.objects.filter((object) =>
    (!sourceType || object.type === sourceType) && (!sourceGroup || object.group === sourceGroup),
  );
}

function semanticProjectionFields(projection: SemanticProjection): string[] {
  if (projection.family === "categorical") return [projection.dimension, projection.measure].filter(Boolean) as string[];
  if (projection.family === "temporal") return [projection.start, projection.end, projection.measure, projection.lane].filter(Boolean) as string[];
  if (projection.family === "matrix") return [projection.row, projection.column, projection.measure].filter(Boolean) as string[];
  if (projection.family === "hierarchy") return [projection.parentField, projection.orderField].filter(Boolean) as string[];
  if (projection.family === "network") return [projection.weightField].filter(Boolean) as string[];
  if (projection.family === "spatial") return [projection.geometryField, projection.labelField].filter(Boolean) as string[];
  if (projection.family === "document") return [projection.contentField, projection.rangeField, projection.orderField].filter(Boolean) as string[];
  return [projection.timeField, projection.authorField, projection.threadField, projection.contentField].filter(Boolean) as string[];
}

function validateSemanticProjectionReferences(
  page: JuanPageDocument,
  projection: SemanticProjection,
  candidates: PageObject[],
  fieldsByObject: Map<string, Set<string>>,
): void {
  for (const field of semanticProjectionFields(projection)) {
    if (["id", "name", "type", "group", "status"].includes(field)) continue;
    if (!candidates.some((object) => fieldsByObject.get(object.id)?.has(field))) {
      invalid(`Projection "${projection.id}" field "${field}" is unavailable.`);
    }
  }
  if (projection.family === "hierarchy" && projection.relationKind
    && !(page.relations ?? []).some((relation) => relation.kind === projection.relationKind)) {
    invalid(`Hierarchy projection "${projection.id}" relation kind "${projection.relationKind}" is unavailable.`);
  }
}

function validateStateObjectIds(
  name: string,
  values: Record<string, readonly string[]> | undefined,
  objectIds: Set<string>,
): void {
  for (const [stateKey, ids] of Object.entries(values ?? {})) {
    for (const objectId of ids) {
      if (!objectIds.has(objectId)) invalid(`Initial ${name} "${stateKey}" references unknown object "${objectId}".`);
    }
  }
}

export function validatePage(input: unknown): JuanPageDocument {
  const parsed = juanPageSchema.safeParse(input);
  if (!parsed.success) {
    throw new DocumentValidationError(
      "This JuanPage is invalid.",
      parsed.error.issues.slice(0, 40).map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("\n"),
    );
  }
  const page = parsed.data;
  const objectIds = new Set<string>();
  const fieldsByObject = new Map<string, Set<string>>();
  for (const object of page.objects) {
    duplicate(objectIds, object.id, "object");
    const fieldKeys = new Set<string>();
    for (const field of object.fields ?? []) {
      if (fieldKeys.has(field.key)) invalid(`Object "${object.id}" has duplicate field key "${field.key}".`);
      fieldKeys.add(field.key);
    }
    fieldsByObject.set(object.id, fieldKeys);
  }

  const relationIds = new Set<string>();
  for (const relation of page.relations ?? []) {
    duplicate(relationIds, relation.id, "relation");
    if (!objectIds.has(relation.from) || !objectIds.has(relation.to)) invalid(`Relation "${relation.id}" references an unknown object.`);
  }

  const metricIds = new Set<string>();
  for (const metric of page.metrics ?? []) duplicate(metricIds, metric.id, "metric");

  const scopeIds = new Set<string>();
  for (const scope of page.scopes ?? []) {
    duplicate(scopeIds, scope.id, "scope");
    const candidates = scope.objectTypes?.length
      ? page.objects.filter((object) => scope.objectTypes!.includes(object.type))
      : page.objects;
    if (!candidates.some((object) => fieldsByObject.get(object.id)?.has(scope.field))) {
      invalid(`Scope "${scope.id}" references field "${scope.field}", but no applicable object contains it.`);
    }
  }

  const projectionIds = new Set<string>();
  for (const projection of page.projections ?? []) {
    duplicate(projectionIds, projection.id, "projection");
    const candidates = sourceObjects(page, projection.sourceType, projection.sourceGroup);
    if (!candidates.length) invalid(`Projection "${projection.id}" has no source objects.`);
    if ("family" in projection) {
      validateSemanticProjectionReferences(page, projection, candidates, fieldsByObject);
    } else {
      if (!candidates.some((object) => fieldsByObject.get(object.id)?.has(projection.dimension))) {
        invalid(`Projection "${projection.id}" dimension "${projection.dimension}" is unavailable.`);
      }
      if (projection.operation !== "count"
        && !candidates.some((object) => fieldsByObject.get(object.id)?.has(projection.measure))) {
        invalid(`Projection "${projection.id}" measure "${projection.measure}" is unavailable.`);
      }
      for (const scopeId of projection.ignoreScopes ?? []) {
        if (!scopeIds.has(scopeId)) invalid(`Projection "${projection.id}" ignores unknown scope "${scopeId}".`);
      }
    }
  }

  for (const metric of page.metrics ?? []) {
    for (const scopeId of metric.ignoreScopes ?? []) {
      if (!scopeIds.has(scopeId)) invalid(`Metric "${metric.id}" ignores unknown scope "${scopeId}".`);
    }
  }

  const affordanceIds = new Set<string>();
  const affordances = new Map<string, PageAffordance>();
  const selectionIds = new Set<string>();
  for (const affordance of page.affordances ?? []) {
    duplicate(affordanceIds, affordance.id, "affordance");
    affordances.set(affordance.id, affordance);
    const effect = affordance.effect;
    const inputKind = affordance.input.kind;
    if (effect.kind === "set" || effect.kind === "scope") {
      if (inputKind === "none") invalid(`Affordance "${affordance.id}" needs an input domain.`);
    } else if (inputKind !== "none") {
      invalid(`Affordance "${affordance.id}" effect "${effect.kind}" must use input kind "none".`);
    }
    if (effect.kind === "scope" && !scopeIds.has(effect.scope)) invalid(`Affordance "${affordance.id}" references unknown scope "${effect.scope}".`);
    if (effect.kind === "select") selectionIds.add(effect.selection);
    if (effect.kind === "copy" && effect.source === "field" && !effect.field) invalid(`Affordance "${affordance.id}" copies a field but does not name one.`);
    if (effect.kind === "copy" && effect.source === "url" && !effect.url) invalid(`Affordance "${affordance.id}" copies a URL but does not provide one.`);
    if (inputKind === "number" && affordance.input.presentation === "adjust"
      && (affordance.input.min === undefined || affordance.input.max === undefined)) {
      invalid(`Adjust affordance "${affordance.id}" needs both min and max.`);
    }
  }

  const bindingIds = new Set<string>();
  for (const binding of page.bindings ?? []) {
    duplicate(bindingIds, binding.id, "binding");
    const affordance = affordances.get(binding.affordance);
    if (!affordance) invalid(`Binding "${binding.id}" references unknown affordance "${binding.affordance}".`);
    const target = binding.target;
    if ((target.kind === "object" || target.kind === "field") && !objectIds.has(target.object)) {
      invalid(`Binding "${binding.id}" references unknown object "${target.object}".`);
    }
    if (target.kind === "field" && !fieldsByObject.get(target.object)?.has(target.field)) {
      invalid(`Binding "${binding.id}" references unknown field "${target.object}.${target.field}".`);
    }
    if (target.kind === "metric" && !metricIds.has(target.metric)) invalid(`Binding "${binding.id}" references unknown metric "${target.metric}".`);
    if (target.kind === "relation" && !relationIds.has(target.relation)) invalid(`Binding "${binding.id}" references unknown relation "${target.relation}".`);
    if (target.kind === "projection" && !projectionIds.has(target.projection)) invalid(`Binding "${binding.id}" references unknown projection "${target.projection}".`);

    if (affordance.effect.kind === "set") {
      if (target.kind !== "object" && target.kind !== "field") invalid(`Set affordance binding "${binding.id}" must target an object or field.`);
      if (target.kind === "field" && target.field !== affordance.effect.field) {
        invalid(`Binding "${binding.id}" targets field "${target.field}" but affordance sets "${affordance.effect.field}".`);
      }
      if (target.kind === "object" && !fieldsByObject.get(target.object)?.has(affordance.effect.field)) {
        invalid(`Binding "${binding.id}" cannot set missing field "${target.object}.${affordance.effect.field}".`);
      }
    }
    if (target.kind === "projection" && !["scope", "select", "inspect"].includes(affordance.effect.kind)) {
      invalid(`Projection binding "${binding.id}" cannot use effect "${affordance.effect.kind}".`);
    }
  }

  for (const scopeId of Object.keys(page.state?.scopes ?? {})) {
    if (!scopeIds.has(scopeId)) invalid(`Initial state references unknown scope "${scopeId}".`);
  }
  for (const selectionId of Object.keys(page.state?.selections ?? {})) {
    if (!selectionIds.has(selectionId)) invalid(`Initial state references unknown selection "${selectionId}".`);
  }
  validateStateObjectIds("expansion", page.state?.expansions, objectIds);
  validateStateObjectIds("path", page.state?.paths, objectIds);
  validateStateObjectIds("ordering", page.state?.ordering, objectIds);
  return page;
}

export function pageObject(page: JuanPageDocument, objectId: string): PageObject | undefined {
  return page.objects.find((object) => object.id === objectId);
}

export function objectField(object: PageObject, fieldKey: string): PageField | undefined {
  return object.fields?.find((field) => field.key === fieldKey);
}

export function pageAffordance(page: JuanPageDocument, affordanceId: string): PageAffordance | undefined {
  return page.affordances?.find((affordance) => affordance.id === affordanceId);
}

export function humanizeKey(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[._:-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
