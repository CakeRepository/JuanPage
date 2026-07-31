import { z } from "zod";
import type { PageObject, PageRelation } from "../schema/page.js";
import {
  isSemanticValue,
  semanticValueSchema,
  type PageScalar,
  type PageValue,
  type SemanticValue,
} from "../schema/value.js";

const id = z.string().min(1).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const key = z.string().min(1).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const text = z.string().min(1).max(300);
const aggregate = z.enum(["count", "sum", "average", "min", "max"]);
const base = {
  id,
  label: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  sourceType: z.string().min(1).max(80).optional(),
  sourceGroup: z.string().min(1).max(120).optional(),
  limit: z.number().int().positive().max(200).optional(),
};

const categoricalProjectionSchema = z.object({
  ...base,
  family: z.literal("categorical"),
  dimension: key,
  measure: key.optional(),
  aggregate,
  order: z.enum(["key-asc", "key-desc", "value-asc", "value-desc"]).optional(),
}).strict();

const temporalProjectionSchema = z.object({
  ...base,
  family: z.literal("temporal"),
  start: key,
  end: key.optional(),
  measure: key.optional(),
  lane: key.optional(),
}).strict();

const matrixProjectionSchema = z.object({
  ...base,
  family: z.literal("matrix"),
  row: key,
  column: key,
  measure: key.optional(),
  aggregate,
}).strict();

const hierarchyProjectionSchema = z.object({
  ...base,
  family: z.literal("hierarchy"),
  parentField: key.optional(),
  relationKind: text.optional(),
  orderField: key.optional(),
}).strict();

const networkProjectionSchema = z.object({
  ...base,
  family: z.literal("network"),
  relationKinds: z.array(text).min(1).max(30).optional(),
  directed: z.boolean().optional(),
  weightField: key.optional(),
}).strict();

const spatialProjectionSchema = z.object({
  ...base,
  family: z.literal("spatial"),
  geometryField: key,
  labelField: key.optional(),
}).strict();

const documentProjectionSchema = z.object({
  ...base,
  family: z.literal("document"),
  contentField: key,
  rangeField: key.optional(),
  orderField: key.optional(),
}).strict();

const streamProjectionSchema = z.object({
  ...base,
  family: z.literal("stream"),
  timeField: key,
  authorField: key.optional(),
  threadField: key.optional(),
  contentField: key.optional(),
}).strict();

export const semanticProjectionSchema = z.discriminatedUnion("family", [
  categoricalProjectionSchema,
  temporalProjectionSchema,
  matrixProjectionSchema,
  hierarchyProjectionSchema,
  networkProjectionSchema,
  spatialProjectionSchema,
  documentProjectionSchema,
  streamProjectionSchema,
]).superRefine((value, context) => {
  if ((value.family === "categorical" || value.family === "matrix") && value.aggregate !== "count" && !value.measure) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: `non-count ${value.family} projections require a measure` });
  }
  if (value.family === "hierarchy" && !value.parentField && !value.relationKind) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "hierarchy requires parentField or relationKind" });
  }
});

export type SemanticProjection = z.infer<typeof semanticProjectionSchema>;

type ProjectionSource = Readonly<{
  objects: readonly PageObject[];
  relations?: readonly PageRelation[];
}>;

type CategoricalResult = Readonly<{
  family: "categorical";
  projectionId: string;
  buckets: readonly Readonly<{ key: PageScalar; label: string; value: number; objectIds: readonly string[] }>[];
}>;

type TemporalResult = Readonly<{
  family: "temporal";
  projectionId: string;
  events: readonly Readonly<{
    objectId: string;
    label: string;
    start: string;
    end?: string;
    lane?: string;
    value?: number;
  }>[];
}>;

type MatrixResult = Readonly<{
  family: "matrix";
  projectionId: string;
  rows: readonly string[];
  columns: readonly string[];
  cells: readonly Readonly<{ row: string; column: string; value: number; objectIds: readonly string[] }>[];
}>;

type HierarchyResult = Readonly<{
  family: "hierarchy";
  projectionId: string;
  roots: readonly string[];
  nodes: readonly Readonly<{ objectId: string; label: string; parentId?: string; order: number }>[];
}>;

type NetworkResult = Readonly<{
  family: "network";
  projectionId: string;
  directed: boolean;
  nodes: readonly Readonly<{ objectId: string; label: string; type: string }>[];
  edges: readonly Readonly<{ relationId: string; from: string; to: string; kind: string; label?: string; weight?: number }>[];
}>;

type SpatialResult = Readonly<{
  family: "spatial";
  projectionId: string;
  features: readonly Readonly<{ objectId: string; label: string; geometry: SemanticValue }>[];
}>;

type DocumentResult = Readonly<{
  family: "document";
  projectionId: string;
  blocks: readonly Readonly<{
    objectId: string;
    label: string;
    content: PageValue;
    range?: SemanticValue;
    order: number;
  }>[];
}>;

type StreamResult = Readonly<{
  family: "stream";
  projectionId: string;
  events: readonly Readonly<{
    objectId: string;
    label: string;
    timestamp: string;
    author?: string;
    thread?: string;
    content?: PageValue;
  }>[];
}>;

export type SemanticProjectionResult =
  | CategoricalResult
  | TemporalResult
  | MatrixResult
  | HierarchyResult
  | NetworkResult
  | SpatialResult
  | DocumentResult
  | StreamResult;

function fieldValue(object: PageObject, field: string): PageValue | undefined {
  if (field === "id") return object.id;
  if (field === "name") return object.name;
  if (field === "type") return object.type;
  if (field === "group") return object.group;
  if (field === "status") return object.status;
  return object.fields?.find((candidate) => candidate.key === field)?.value;
}

function scalar(value: PageValue | undefined): PageScalar | undefined {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? value
    : undefined;
}

function label(value: PageValue | undefined): string | undefined {
  const primitive = scalar(value);
  if (primitive === null || primitive === undefined) return undefined;
  return String(primitive);
}

function numberValue(value: PageValue | undefined): number | undefined {
  if (typeof value === "number") return value;
  if (!isSemanticValue(value)) return undefined;
  if (value[0] === "quantity" || value[0] === "uncertainty" || value[0] === "duration") return value[1];
  return undefined;
}

function instantValue(value: PageValue | undefined, edge: "start" | "end" = "start"): string | undefined {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  if (!isSemanticValue(value)) return undefined;
  if (value[0] === "instant") return new Date(value[1]).toISOString();
  if (value[0] === "interval") return new Date(edge === "start" ? value[1] : value[2]).toISOString();
  return undefined;
}

function aggregateValues(operation: "count" | "sum" | "average" | "min" | "max", values: readonly number[]): number {
  if (operation === "count") return values.length;
  if (!values.length) return 0;
  if (operation === "sum") return values.reduce((sum, value) => sum + value, 0);
  if (operation === "average") return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (operation === "min") return Math.min(...values);
  return Math.max(...values);
}

function sourceObjects(source: ProjectionSource, projection: SemanticProjection): PageObject[] {
  const objects = source.objects.filter((object) =>
    (!projection.sourceType || object.type === projection.sourceType)
    && (!projection.sourceGroup || object.group === projection.sourceGroup),
  );
  return projection.limit ? objects.slice(0, projection.limit) : objects;
}

function evaluateCategorical(source: ProjectionSource, projection: Extract<SemanticProjection, { family: "categorical" }>): CategoricalResult {
  const buckets = new Map<string, { key: PageScalar; values: number[]; objectIds: string[] }>();
  for (const object of sourceObjects(source, projection)) {
    const keyValue = scalar(fieldValue(object, projection.dimension));
    if (keyValue === undefined || keyValue === null) continue;
    const bucketKey = JSON.stringify(keyValue);
    const bucket = buckets.get(bucketKey) ?? { key: keyValue, values: [], objectIds: [] };
    const measure = projection.aggregate === "count" ? 1 : numberValue(fieldValue(object, projection.measure!));
    if (measure === undefined) continue;
    bucket.values.push(measure);
    bucket.objectIds.push(object.id);
    buckets.set(bucketKey, bucket);
  }
  let result = [...buckets.values()].map((bucket) => ({
    key: bucket.key,
    label: String(bucket.key),
    value: aggregateValues(projection.aggregate, bucket.values),
    objectIds: bucket.objectIds,
  }));
  const order = projection.order ?? "key-asc";
  result.sort((left, right) => {
    const direction = order.endsWith("desc") ? -1 : 1;
    return order.startsWith("value")
      ? (left.value - right.value) * direction
      : left.label.localeCompare(right.label, undefined, { numeric: true }) * direction;
  });
  return { family: "categorical", projectionId: projection.id, buckets: result };
}

function evaluateTemporal(source: ProjectionSource, projection: Extract<SemanticProjection, { family: "temporal" }>): TemporalResult {
  const events = sourceObjects(source, projection).flatMap((object) => {
    const start = instantValue(fieldValue(object, projection.start), "start");
    if (!start) return [];
    const startValue = fieldValue(object, projection.start);
    const end = projection.end
      ? instantValue(fieldValue(object, projection.end), "end")
      : instantValue(startValue, "end");
    const lane = projection.lane ? label(fieldValue(object, projection.lane)) : undefined;
    const value = projection.measure ? numberValue(fieldValue(object, projection.measure)) : undefined;
    return [{ objectId: object.id, label: object.name, start, end: end === start ? undefined : end, lane, value }];
  });
  events.sort((left, right) => left.start.localeCompare(right.start) || left.objectId.localeCompare(right.objectId));
  return { family: "temporal", projectionId: projection.id, events };
}

function evaluateMatrix(source: ProjectionSource, projection: Extract<SemanticProjection, { family: "matrix" }>): MatrixResult {
  const buckets = new Map<string, { row: string; column: string; values: number[]; objectIds: string[] }>();
  for (const object of sourceObjects(source, projection)) {
    const row = label(fieldValue(object, projection.row));
    const column = label(fieldValue(object, projection.column));
    if (!row || !column) continue;
    const value = projection.aggregate === "count" ? 1 : numberValue(fieldValue(object, projection.measure!));
    if (value === undefined) continue;
    const keyValue = `${JSON.stringify(row)}:${JSON.stringify(column)}`;
    const bucket = buckets.get(keyValue) ?? { row, column, values: [], objectIds: [] };
    bucket.values.push(value);
    bucket.objectIds.push(object.id);
    buckets.set(keyValue, bucket);
  }
  const rows = [...new Set([...buckets.values()].map((bucket) => bucket.row))].sort();
  const columns = [...new Set([...buckets.values()].map((bucket) => bucket.column))].sort();
  const cells = [...buckets.values()]
    .map((bucket) => ({
      row: bucket.row,
      column: bucket.column,
      value: aggregateValues(projection.aggregate, bucket.values),
      objectIds: bucket.objectIds,
    }))
    .sort((left, right) => left.row.localeCompare(right.row) || left.column.localeCompare(right.column));
  return { family: "matrix", projectionId: projection.id, rows, columns, cells };
}

function hierarchyParentMap(
  source: ProjectionSource,
  projection: Extract<SemanticProjection, { family: "hierarchy" }>,
): Map<string, string> {
  const parents = new Map<string, string>();
  if (projection.parentField) {
    for (const object of sourceObjects(source, projection)) {
      const parent = label(fieldValue(object, projection.parentField));
      if (parent) parents.set(object.id, parent);
    }
  }
  if (projection.relationKind) {
    for (const relation of source.relations ?? []) {
      if (relation.kind === projection.relationKind) parents.set(relation.to, relation.from);
    }
  }
  return parents;
}

function evaluateHierarchy(source: ProjectionSource, projection: Extract<SemanticProjection, { family: "hierarchy" }>): HierarchyResult {
  const objects = sourceObjects(source, projection);
  const ids = new Set(objects.map((object) => object.id));
  const parents = hierarchyParentMap(source, projection);
  const nodes = objects.map((object) => {
    const parent = parents.get(object.id);
    const order = projection.orderField ? numberValue(fieldValue(object, projection.orderField)) ?? 0 : 0;
    return { objectId: object.id, label: object.name, parentId: parent && ids.has(parent) ? parent : undefined, order };
  }).sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));

  for (const node of nodes) {
    const seen = new Set<string>([node.objectId]);
    let parent = node.parentId;
    while (parent) {
      if (seen.has(parent)) throw new Error(`Hierarchy projection ${projection.id} contains a cycle at ${parent}`);
      seen.add(parent);
      parent = parents.get(parent);
    }
  }
  return {
    family: "hierarchy",
    projectionId: projection.id,
    roots: nodes.filter((node) => !node.parentId).map((node) => node.objectId),
    nodes,
  };
}

function evaluateNetwork(source: ProjectionSource, projection: Extract<SemanticProjection, { family: "network" }>): NetworkResult {
  const objects = sourceObjects(source, projection);
  const ids = new Set(objects.map((object) => object.id));
  const allowedKinds = projection.relationKinds ? new Set(projection.relationKinds) : undefined;
  const edges = (source.relations ?? []).filter((relation) =>
    ids.has(relation.from)
    && ids.has(relation.to)
    && (!allowedKinds || allowedKinds.has(relation.kind)),
  ).map((relation) => {
    const owner = objects.find((object) => object.id === relation.from);
    const weight = projection.weightField && owner ? numberValue(fieldValue(owner, projection.weightField)) : undefined;
    return { relationId: relation.id, from: relation.from, to: relation.to, kind: relation.kind, label: relation.label, weight };
  }).sort((left, right) => left.relationId.localeCompare(right.relationId));
  return {
    family: "network",
    projectionId: projection.id,
    directed: projection.directed ?? true,
    nodes: objects.map((object) => ({ objectId: object.id, label: object.name, type: object.type })),
    edges,
  };
}

function evaluateSpatial(source: ProjectionSource, projection: Extract<SemanticProjection, { family: "spatial" }>): SpatialResult {
  const supported = new Set(["coordinate", "bounds", "path", "geometry"]);
  const features = sourceObjects(source, projection).flatMap((object) => {
    const geometry = fieldValue(object, projection.geometryField);
    if (!isSemanticValue(geometry) || !supported.has(geometry[0])) return [];
    return [{
      objectId: object.id,
      label: projection.labelField ? label(fieldValue(object, projection.labelField)) ?? object.name : object.name,
      geometry,
    }];
  });
  return { family: "spatial", projectionId: projection.id, features };
}

function evaluateDocument(source: ProjectionSource, projection: Extract<SemanticProjection, { family: "document" }>): DocumentResult {
  const blocks = sourceObjects(source, projection).flatMap((object) => {
    const content = fieldValue(object, projection.contentField);
    if (content === undefined) return [];
    const range = projection.rangeField ? fieldValue(object, projection.rangeField) : undefined;
    const typedRange = isSemanticValue(range) && range[0] === "content-range" ? range : undefined;
    const order = projection.orderField ? numberValue(fieldValue(object, projection.orderField)) ?? 0 : 0;
    return [{ objectId: object.id, label: object.name, content, range: typedRange, order }];
  }).sort((left, right) => left.order - right.order || left.objectId.localeCompare(right.objectId));
  return { family: "document", projectionId: projection.id, blocks };
}

function evaluateStream(source: ProjectionSource, projection: Extract<SemanticProjection, { family: "stream" }>): StreamResult {
  const events = sourceObjects(source, projection).flatMap((object) => {
    const timestamp = instantValue(fieldValue(object, projection.timeField));
    if (!timestamp) return [];
    return [{
      objectId: object.id,
      label: object.name,
      timestamp,
      author: projection.authorField ? label(fieldValue(object, projection.authorField)) : undefined,
      thread: projection.threadField ? label(fieldValue(object, projection.threadField)) : undefined,
      content: projection.contentField ? fieldValue(object, projection.contentField) : undefined,
    }];
  }).sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.objectId.localeCompare(right.objectId));
  return { family: "stream", projectionId: projection.id, events };
}

export function validateSemanticProjection(input: unknown): SemanticProjection {
  return semanticProjectionSchema.parse(input);
}

export function evaluateSemanticProjection(
  source: ProjectionSource,
  projectionInput: unknown,
): SemanticProjectionResult {
  const projection = validateSemanticProjection(projectionInput);
  if (projection.family === "categorical") return evaluateCategorical(source, projection);
  if (projection.family === "temporal") return evaluateTemporal(source, projection);
  if (projection.family === "matrix") return evaluateMatrix(source, projection);
  if (projection.family === "hierarchy") return evaluateHierarchy(source, projection);
  if (projection.family === "network") return evaluateNetwork(source, projection);
  if (projection.family === "spatial") return evaluateSpatial(source, projection);
  if (projection.family === "document") return evaluateDocument(source, projection);
  return evaluateStream(source, projection);
}

export function projectionAcceptsSemanticValue(value: unknown): boolean {
  return semanticValueSchema.safeParse(value).success;
}
