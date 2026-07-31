import { z } from "zod";
import { LIMITS } from "./limits.js";
import { isAllowedUrl } from "./url.js";

const boundedText = z.string().max(LIMITS.maxTextLength);
const shortText = z.string().min(1).max(160);
const finite = z.number().finite();
const isoInstant = z.string().max(64).refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "expected an ISO-8601 instant",
});
const safeUrl = z.string().max(LIMITS.maxUrlLength).refine((value) => isAllowedUrl(value), {
  message: "URL must be https (or localhost during development)",
});
const nullableShortText = z.union([shortText, z.null()]);
const nullableFinite = z.union([finite, z.null()]);

export const pageScalarSchema = z.union([
  boundedText,
  finite,
  z.boolean(),
  z.null(),
]);

const instantValueSchema = z.tuple([z.literal("instant"), isoInstant]);
const intervalValueSchema = z.tuple([
  z.literal("interval"),
  isoInstant,
  isoInstant,
  z.boolean(),
  z.boolean(),
]).superRefine((value, context) => {
  if (Date.parse(value[1]) > Date.parse(value[2])) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "interval start must not be after end" });
  }
});
const durationValueSchema = z.tuple([
  z.literal("duration"),
  finite,
  z.enum(["millisecond", "second", "minute", "hour", "day", "week", "month", "year"]),
]);
const recurrenceValueSchema = z.tuple([
  z.literal("recurrence"),
  z.string().min(1).max(500),
  nullableShortText,
]);
const coordinateValueSchema = z.tuple([
  z.literal("coordinate"),
  shortText,
  finite,
  finite,
  nullableFinite,
]);
const boundsValueSchema = z.tuple([
  z.literal("bounds"),
  shortText,
  finite,
  finite,
  finite,
  finite,
  nullableFinite,
  nullableFinite,
]).superRefine((value, context) => {
  if (value[2] > value[4] || value[3] > value[5]) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "bounds minimum must not exceed maximum" });
  }
  if (value[6] !== null && value[7] !== null && value[6] > value[7]) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "bounds minimum z must not exceed maximum z" });
  }
});
const pathValueSchema = z.tuple([
  z.literal("path"),
  shortText,
  z.union([z.literal(2), z.literal(3)]),
]).rest(finite).superRefine((value, context) => {
  const dimension = value[2];
  const ordinates = value.length - 3;
  if (ordinates < dimension * 2 || ordinates % dimension !== 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "path must contain at least two complete points" });
  }
  if (ordinates / dimension > 15) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "path may contain at most 15 points" });
  }
});
const geometryValueSchema = z.tuple([
  z.literal("geometry"),
  z.enum(["point", "line", "polygon"]),
  shortText,
  z.union([z.literal(2), z.literal(3)]),
]).rest(finite).superRefine((value, context) => {
  const shape = value[1];
  const dimension = value[3];
  const ordinates = value.length - 4;
  const points = ordinates / dimension;
  if (ordinates % dimension !== 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "geometry ordinates must match its dimension" });
  }
  if ((shape === "point" && points !== 1) || (shape === "line" && points < 2) || (shape === "polygon" && points < 3)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: `geometry ${shape} has an invalid point count` });
  }
  if (points > 15) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "geometry may contain at most 15 points" });
  }
});
const contentValueSchema = z.tuple([
  z.literal("content"),
  z.string().min(1).max(120),
  z.union([safeUrl, z.null()]),
  z.union([boundedText, z.null()]),
  nullableShortText,
  nullableShortText,
]).superRefine((value, context) => {
  if (value[2] === null && value[3] === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "content must include a URL or inline text" });
  }
});
const contentRangeValueSchema = z.tuple([
  z.literal("content-range"),
  shortText,
  z.enum(["byte", "character", "line", "item", "second"]),
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
]).superRefine((value, context) => {
  if (value[3] > value[4]) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "content range start must not exceed end" });
  }
});
const mediaValueSchema = z.tuple([
  z.literal("media"),
  z.string().min(1).max(120),
  safeUrl,
  nullableShortText,
  nullableFinite,
  nullableShortText,
]);
const timeRangeValueSchema = z.tuple([
  z.literal("time-range"),
  finite.nonnegative(),
  finite.nonnegative(),
  nullableShortText,
]).superRefine((value, context) => {
  if (value[1] > value[2]) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "time range start must not exceed end" });
  }
});
const quantityValueSchema = z.tuple([
  z.literal("quantity"),
  finite,
  z.string().min(1).max(40),
]);
const uncertaintyValueSchema = z.tuple([
  z.literal("uncertainty"),
  finite,
  finite,
  finite,
  z.number().min(0).max(1),
]).superRefine((value, context) => {
  if (value[2] > value[1] || value[1] > value[3]) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "uncertainty value must fall within lower and upper bounds" });
  }
});
const distributionValueSchema = z.tuple([
  z.literal("distribution"),
  z.string().max(40),
]).rest(z.union([shortText, finite])).superRefine((value, context) => {
  const cells = value.slice(2);
  if (cells.length < 2 || cells.length % 2 !== 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "distribution must contain label/value pairs" });
    return;
  }
  if (cells.length / 2 > 20) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "distribution may contain at most 20 buckets" });
  }
  for (let index = 0; index < cells.length; index += 2) {
    if (typeof cells[index] !== "string" || typeof cells[index + 1] !== "number") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "distribution buckets must alternate string labels and numeric values" });
      return;
    }
  }
});
const matrixValueSchema = z.tuple([
  z.literal("matrix"),
  z.number().int().positive().max(6),
  z.number().int().positive().max(6),
  z.string().max(500),
  z.string().max(500),
]).rest(finite).superRefine((value, context) => {
  const rows = value[1];
  const columns = value[2];
  if (value.length - 5 !== rows * columns) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "matrix value count must equal rows multiplied by columns" });
  }
  try {
    const rowLabels = JSON.parse(value[3]) as unknown;
    const columnLabels = JSON.parse(value[4]) as unknown;
    if (!Array.isArray(rowLabels) || rowLabels.length !== rows || rowLabels.some((label) => typeof label !== "string")) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "matrix row labels must match row count" });
    }
    if (!Array.isArray(columnLabels) || columnLabels.length !== columns || columnLabels.some((label) => typeof label !== "string")) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "matrix column labels must match column count" });
    }
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "matrix labels must be JSON string arrays" });
  }
});

export const semanticValueSchema = z.union([
  instantValueSchema,
  intervalValueSchema,
  durationValueSchema,
  recurrenceValueSchema,
  coordinateValueSchema,
  boundsValueSchema,
  pathValueSchema,
  geometryValueSchema,
  contentValueSchema,
  contentRangeValueSchema,
  mediaValueSchema,
  timeRangeValueSchema,
  quantityValueSchema,
  uncertaintyValueSchema,
  distributionValueSchema,
  matrixValueSchema,
]);

const semanticTags = new Set([
  "instant",
  "interval",
  "duration",
  "recurrence",
  "coordinate",
  "bounds",
  "path",
  "geometry",
  "content",
  "content-range",
  "media",
  "time-range",
  "quantity",
  "uncertainty",
  "distribution",
  "matrix",
]);

const scalarListSchema = z.array(pageScalarSchema).max(50).refine(
  (value) => typeof value[0] !== "string" || !semanticTags.has(value[0]),
  { message: "reserved semantic value tags must use their typed tuple shape" },
);

export const pageValueSchema = z.union([pageScalarSchema, semanticValueSchema, scalarListSchema]);

export type PageScalar = z.infer<typeof pageScalarSchema>;
export type SemanticValue = z.infer<typeof semanticValueSchema>;
export type PageValue = z.infer<typeof pageValueSchema>;

export function isSemanticValue(value: unknown): value is SemanticValue {
  return semanticValueSchema.safeParse(value).success;
}

export function semanticValueTag(value: SemanticValue): SemanticValue[0] {
  return value[0];
}

export function formatSemanticValue(value: SemanticValue, locale = "en-US"): string {
  if (value[0] === "instant") return new Date(value[1]).toLocaleString(locale);
  if (value[0] === "interval") return `${new Date(value[1]).toLocaleString(locale)} – ${new Date(value[2]).toLocaleString(locale)}`;
  if (value[0] === "duration") return `${value[1]} ${value[2]}${Math.abs(value[1]) === 1 ? "" : "s"}`;
  if (value[0] === "recurrence") return value[2] ? `${value[1]} · ${value[2]}` : value[1];
  if (value[0] === "coordinate") return `${value[1]} · ${value.slice(2).filter((item) => item !== null).join(", ")}`;
  if (value[0] === "bounds") return `${value[1]} · ${value.slice(2).filter((item) => item !== null).join(", ")}`;
  if (value[0] === "path") return `${(value.length - 3) / value[2]} points · ${value[1]}`;
  if (value[0] === "geometry") return `${value[1]} · ${(value.length - 4) / value[3]} points · ${value[2]}`;
  if (value[0] === "content") return value[4] ?? value[2] ?? value[3] ?? "Content";
  if (value[0] === "content-range") return `${value[1]} · ${value[3]}–${value[4]} ${value[2]}s`;
  if (value[0] === "media") return value[3] ?? `${value[1]} media`;
  if (value[0] === "time-range") return `${value[1]}s–${value[2]}s${value[3] ? ` · ${value[3]}` : ""}`;
  if (value[0] === "quantity") return `${new Intl.NumberFormat(locale).format(value[1])} ${value[2]}`;
  if (value[0] === "uncertainty") return `${new Intl.NumberFormat(locale).format(value[1])} (${value[2]}–${value[3]}, ${Math.round(value[4] * 100)}%)`;
  if (value[0] === "distribution") return `${(value.length - 2) / 2} buckets${value[1] ? ` · ${value[1]}` : ""}`;
  return `${value[1]}×${value[2]} matrix`;
}

export function matrixValue(
  rowLabels: readonly string[],
  columnLabels: readonly string[],
  values: readonly number[],
): SemanticValue {
  return semanticValueSchema.parse([
    "matrix",
    rowLabels.length,
    columnLabels.length,
    JSON.stringify(rowLabels),
    JSON.stringify(columnLabels),
    ...values,
  ]);
}
