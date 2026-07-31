import { validatePage, type JuanPageDocument, type PageScalar, type PageValue } from "../schema/page.js";

export type SymbolId = string;
export type MeaningText = readonly [0, SymbolId] | readonly [1, string];
export type MeaningRecord = readonly unknown[];
export type MeaningPacket = readonly [1, SymbolId, number, SymbolId | null, readonly (readonly [SymbolId, string])[], readonly MeaningRecord[]];
export type MeaningDelta = readonly [1, SymbolId, number, number, readonly (readonly [20 | 21, SymbolId, SymbolId, PageScalar?])[]];
export type RendererCapabilities = readonly [1, string, number, number, readonly SymbolId[], number, number, 0 | 1];

export const MeaningOpcode = { Header: 0, Entity: 1, Fact: 2, Relation: 3, Action: 4, Metric: 5, Signal: 6, Evidence: 7, Permission: 8 } as const;
export const MeaningMutationOpcode = { SetFact: 20, RemoveFact: 21 } as const;
export const InputCapability = { Pointer: 1, Keyboard: 2, Voice: 4, Touch: 8 } as const;
export const LensCapability = { Cards: 1, Table: 2, Flow: 4 } as const;

export class MeaningProtocolError extends Error {
  constructor(message: string, readonly details: string) { super(message); this.name = "MeaningProtocolError"; }
}

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const themes = ["system", "light", "dark"] as const;
const lenses = ["cards", "table", "flow"] as const;
const groups = ["group", "type", "status", "none"] as const;
const densities = ["comfortable", "compact"] as const;
const tones = ["neutral", "info", "success", "warning", "danger"] as const;
const formats = ["auto", "text", "number", "currency", "percent", "date", "datetime", "duration", "url", "email", "phone", "code"] as const;
const displays = ["auto", "prominent", "detail", "hidden"] as const;

function fail(path: string, message: string): never { throw new MeaningProtocolError("This meaning packet is invalid.", `${path}: ${message}`); }
function assertId(value: unknown, path: string): asserts value is string { if (typeof value !== "string" || !idPattern.test(value)) fail(path, "expected an opaque symbol id"); }
function scalar(value: unknown): value is PageScalar { return value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)); }
function pageValue(value: unknown): value is PageValue { return scalar(value) || (Array.isArray(value) && value.length <= 50 && value.every(scalar)); }
function textRef(value: unknown): value is MeaningText { return Array.isArray(value) && value.length === 2 && (value[0] === 0 || value[0] === 1) && typeof value[1] === "string"; }

export function validateMeaningPacket(input: unknown): MeaningPacket {
  if (!Array.isArray(input) || input.length !== 6 || input[0] !== 1) fail("root", "expected [1, packetId, revision, vocabularyId, vocabulary, records]");
  assertId(input[1], "packetId");
  if (!Number.isInteger(input[2]) || Number(input[2]) < 0) fail("revision", "expected a non-negative integer");
  if (input[3] !== null) assertId(input[3], "vocabularyId");
  if (!Array.isArray(input[4]) || !Array.isArray(input[5])) fail("root", "vocabulary and records must be arrays");
  let headers = 0;
  for (const [index, record] of input[5].entries()) {
    if (!Array.isArray(record) || !Number.isInteger(record[0]) || Number(record[0]) < 0 || Number(record[0]) > 8) fail(`records[${index}]`, "invalid opcode tuple");
    if (record[0] === 0) headers += 1;
    if (record[0] === 1) { assertId(record[1], `records[${index}].id`); assertId(record[2], `records[${index}].type`); if (!textRef(record[3])) fail(`records[${index}].name`, "expected a text reference"); }
    if (record[0] === 2) { assertId(record[1], `records[${index}].entity`); assertId(record[2], `records[${index}].property`); if (!pageValue(record[3])) fail(`records[${index}].value`, "expected a page value"); }
  }
  if (headers !== 1) fail("records", "exactly one header is required");
  return input as unknown as MeaningPacket;
}

function words(packet: MeaningPacket): Map<string, string> { return new Map(packet[4]); }
function resolve(value: unknown, dictionary: Map<string, string>, path: string): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (!textRef(value)) fail(path, "expected [0,symbol] or [1,literal]");
  if (value[0] === 1) return value[1];
  const result = dictionary.get(value[1]);
  if (result === undefined) fail(path, `missing vocabulary symbol ${value[1]}`);
  return result;
}

export const DEFAULT_RENDERER_CAPABILITIES: RendererCapabilities = [1, "en-US", 3, 7, ["*"], 1280, 800, 0];
export function browserRendererCapabilities(): RendererCapabilities {
  const width = typeof window === "undefined" ? 1280 : window.innerWidth;
  const height = typeof window === "undefined" ? 800 : window.innerHeight;
  const locale = typeof navigator === "undefined" ? "en-US" : navigator.language || "en-US";
  const touch = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0 ? 8 : 0;
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 1 : 0;
  return [1, locale, 3 | touch, 7, ["*"], width, height, reduced];
}

export function materializeMeaningPacket(input: unknown, capabilities: RendererCapabilities = DEFAULT_RENDERER_CAPABILITIES): JuanPageDocument {
  const packet = validateMeaningPacket(input);
  const dictionary = words(packet);
  const records = packet[5];
  const header = records.find((record) => record[0] === 0)!;
  const facts = new Map<string, MeaningRecord[]>();
  for (const record of records) if (record[0] === 2) facts.set(String(record[1]), [...(facts.get(String(record[1])) ?? []), record]);
  const objects: JuanPageDocument["objects"] = records.filter((record) => record[0] === 1).map((record) => ({
    id: String(record[1]), type: dictionary.get(String(record[2])) ?? String(record[2]), name: resolve(record[3], dictionary, "entity.name")!,
    group: resolve(record[4], dictionary, "entity.group"), status: resolve(record[5], dictionary, "entity.status"), tone: tones[Number(record[6])] ?? "neutral",
    summary: resolve(record[7], dictionary, "entity.summary"), actionIds: Array.isArray(record[8]) ? record[8].map(String) : undefined,
    tags: Array.isArray(record[9]) ? record[9].map((tag) => resolve(tag, dictionary, "entity.tag")!) : undefined,
    fields: (facts.get(String(record[1])) ?? []).map((fact) => ({ key: String(fact[2]), label: resolve(fact[4], dictionary, "fact.label") ?? dictionary.get(String(fact[2])), value: fact[3] as PageValue, format: formats[Number(fact[5])] ?? "auto", display: displays[Number(fact[6])] ?? "auto", currency: fact[7] ? String(fact[7]) : undefined })),
  }));
  for (const record of records.filter((item) => item[0] === 6)) objects.push({ id: String(record[1]), type: "signal", name: resolve(record[4], dictionary, "signal.reason")!, group: "Signals", status: `${Math.round(Number(record[3]) * 100)}% severity`, tone: Number(record[3]) >= .8 ? "danger" : "warning", summary: resolve(record[6], dictionary, "signal.source"), tags: [`target:${String(record[2])}`], fields: [{ key: "severity", value: Number(record[3]), format: "percent", display: "prominent" }, { key: "confidence", value: Number(record[5]), format: "percent" }] });
  for (const record of records.filter((item) => item[0] === 7)) objects.push({ id: String(record[1]), type: "evidence", name: resolve(record[3], dictionary, "evidence.source")!, group: "Evidence", status: `${Math.round(Number(record[5]) * 100)}% confidence`, tone: "info", summary: resolve(record[4], dictionary, "evidence.claim"), tags: [`target:${String(record[2])}`] });
  for (const record of records.filter((item) => item[0] === 8)) objects.push({ id: `policy:${String(record[1])}`, type: "permission", name: ["Allowed", "Denied", "Human approval required"][Number(record[2])] ?? "Policy", group: "Trust", status: ["Allow", "Deny", "Approval"][Number(record[2])] ?? "Policy", tone: Number(record[2]) === 1 ? "danger" : Number(record[2]) === 2 ? "warning" : "success", summary: resolve(record[3], dictionary, "permission.reason"), tags: [`action:${String(record[1])}`] });
  const actions = records.filter((record) => record[0] === 4).map((record) => {
    const base = { id: String(record[1]), label: resolve(record[3], dictionary, "action.label")!, tone: ["neutral", "primary", "success", "warning", "danger"][Number(record[7])] as "neutral" | "primary" | "success" | "warning" | "danger" };
    if (record[2] === 0) return { ...base, kind: "toggle" as const, target: String(record[4]), field: String(record[5]), initial: typeof record[6] === "boolean" ? record[6] : undefined };
    if (record[2] === 3) { const payload = Array.isArray(record[6]) ? record[6] : []; return { ...base, kind: "text" as const, target: String(record[4]), field: String(record[5]), initial: typeof payload[0] === "string" ? payload[0] : undefined, placeholder: resolve(payload[1], dictionary, "action.placeholder"), multiline: Boolean(payload[2]) }; }
    if (record[2] === 4) return { ...base, kind: "open" as const, url: String(record[4]) };
    return { ...base, kind: "emit" as const, includeObjectIds: Array.isArray(record[6]) ? record[6].map(String) : undefined };
  });
  const requested = Number(header[5]);
  const requestedBit = [1, 2, 4][requested] ?? 1;
  const lens = (capabilities[3] & requestedBit) ? lenses[requested] : (capabilities[3] & 1) ? "cards" : (capabilities[3] & 2) ? "table" : "flow";
  return validatePage({ version: "1.0", title: resolve(header[1], dictionary, "header.title")!, intent: resolve(header[2], dictionary, "header.intent"), description: resolve(header[3], dictionary, "header.description"), theme: themes[Number(header[4])] ?? "system", objects, relations: records.filter((record) => record[0] === 3).map((record) => ({ from: String(record[1]), to: String(record[2]), kind: String(record[3]), label: resolve(record[4], dictionary, "relation.label") ?? dictionary.get(String(record[3])) })), actions, view: { defaultLens: lens, groupBy: groups[Number(header[6])] ?? "group", density: capabilities[5] < 900 ? "compact" : densities[Number(header[7])] ?? "comfortable" }, metadata: { "m1.packetId": packet[1], "m1.revision": packet[2], "m1.vocabularyId": packet[3], "m1.locale": capabilities[1], "m1.records": records.length } });
}

export function createFactDelta(packetId: string, baseRevision: number, target: string, property: string, value: PageScalar): MeaningDelta { return [1, packetId, baseRevision, baseRevision + 1, [[20, target, property, value]]]; }
export function validateMeaningDelta(input: unknown): MeaningDelta {
  if (!Array.isArray(input) || input.length !== 5 || input[0] !== 1) fail("delta", "expected [1, packetId, baseRevision, nextRevision, mutations]");
  assertId(input[1], "delta.packetId");
  if (!Number.isInteger(input[2]) || !Number.isInteger(input[3]) || Number(input[3]) <= Number(input[2]) || !Array.isArray(input[4])) fail("delta", "invalid revision or mutation list");
  for (const mutation of input[4]) { if (!Array.isArray(mutation) || (mutation[0] !== 20 && mutation[0] !== 21)) fail("delta.mutation", "unsupported mutation"); assertId(mutation[1], "delta.target"); assertId(mutation[2], "delta.property"); if (mutation[0] === 20 && !scalar(mutation[3])) fail("delta.value", "expected a scalar"); }
  return input as unknown as MeaningDelta;
}
export function applyMeaningDelta(packetInput: unknown, deltaInput: unknown): MeaningPacket {
  const packet = validateMeaningPacket(packetInput); const delta = validateMeaningDelta(deltaInput);
  if (packet[1] !== delta[1] || packet[2] !== delta[2]) fail("delta", "packet id or base revision mismatch");
  let records = [...packet[5]];
  for (const mutation of delta[4]) {
    if (mutation[0] === 20) { let found = false; records = records.map((record) => record[0] === 2 && record[1] === mutation[1] && record[2] === mutation[2] ? (found = true, [2, mutation[1], mutation[2], mutation[3], record[4], record[5], record[6], record[7]]) : record); if (!found) records.push([2, mutation[1], mutation[2], mutation[3], [1, mutation[2]], 0, 0, null]); }
    else records = records.filter((record) => !(record[0] === 2 && record[1] === mutation[1] && record[2] === mutation[2]));
  }
  return [1, packet[1], delta[3], packet[3], packet[4], records];
}
export const meaningRef = (symbol: SymbolId): MeaningText => [0, symbol];
export const meaningLiteral = (value: string): MeaningText => [1, value];
