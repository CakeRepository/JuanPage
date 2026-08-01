import { z } from "zod";
import { pageScalarSchema, pageValueSchema, type PageScalar, type PageValue } from "./value.js";

const id = z.string().min(1).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

export const pageViewportStateSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  zoom: z.number().finite().positive().max(100),
  rotation: z.number().finite().min(-360).max(360).optional(),
}).strict();

export const pageClockStateSchema = z.object({
  time: z.number().finite(),
  rate: z.number().finite().min(-100).max(100),
  paused: z.boolean(),
  step: z.number().finite().positive().max(1_000_000).optional(),
}).strict();

export const pageInteractionDomainSchema = z.enum([
  "expansions",
  "paths",
  "viewports",
  "ranges",
  "playheads",
  "ordering",
  "groupings",
  "queries",
  "filters",
  "panels",
  "focus",
  "clocks",
]);

export const pageInteractionValueSchema = z.union([
  pageValueSchema,
  z.array(id).max(200),
  pageViewportStateSchema,
  pageClockStateSchema,
]);

export const pageInteractionStateSchema = z.object({
  scopes: z.record(pageScalarSchema).optional(),
  selections: z.record(z.array(id).max(100)).optional(),
  expansions: z.record(z.array(id).max(200)).optional(),
  paths: z.record(z.array(id).max(200)).optional(),
  viewports: z.record(pageViewportStateSchema).optional(),
  ranges: z.record(pageValueSchema).optional(),
  playheads: z.record(z.number().finite()).optional(),
  ordering: z.record(z.array(id).max(200)).optional(),
  groupings: z.record(id).optional(),
  queries: z.record(z.string().max(500)).optional(),
  filters: z.record(pageScalarSchema).optional(),
  panels: z.record(z.string().max(1000)).optional(),
  focus: id.optional(),
  clocks: z.record(pageClockStateSchema).optional(),
}).strict();

export type PageViewportState = z.infer<typeof pageViewportStateSchema>;
export type PageClockState = z.infer<typeof pageClockStateSchema>;
export type PageInteractionDomain = z.infer<typeof pageInteractionDomainSchema>;
export type PageInteractionValue = z.infer<typeof pageInteractionValueSchema>;
export type PageInteractionState = z.infer<typeof pageInteractionStateSchema>;

export function interactionStateValue(
  state: PageInteractionState,
  domain: PageInteractionDomain,
  key: string,
): PageInteractionValue | undefined {
  if (domain === "focus") return state.focus;
  const record = state[domain];
  return record?.[key] as PageInteractionValue | undefined;
}

export function cloneInteractionValue(value: PageInteractionValue | undefined): PageInteractionValue | undefined {
  if (value === undefined || value === null || typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value)) as PageInteractionValue;
}

export function interactionValueToScalarRecord(value: PageInteractionValue): Readonly<Record<string, PageScalar>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value);
  if (entries.every(([, entry]) => entry === null || ["string", "number", "boolean"].includes(typeof entry))) {
    return Object.fromEntries(entries) as Record<string, PageScalar>;
  }
  return undefined;
}

export function interactionValueToPageValue(value: PageInteractionValue): PageValue | undefined {
  if (value === null || ["string", "number", "boolean"].includes(typeof value) || Array.isArray(value)) return value as PageValue;
  return undefined;
}
