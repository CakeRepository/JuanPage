import {
  validatePage,
  type JuanPageDocument,
  type PageAffordance,
  type PageBinding,
  type PageInteractionState,
  type PageScalar,
  type PageValue,
} from "../schema/page.js";

export type SymbolId = string;
export type MeaningText = readonly [0, SymbolId] | readonly [1, string];
export type MeaningRecord = readonly unknown[];
export type MeaningPacket = readonly [
  1,
  SymbolId,
  number,
  SymbolId | null,
  readonly (readonly [SymbolId, string])[],
  readonly MeaningRecord[],
];

export type ActionArguments = Readonly<Record<string, PageScalar>>;
export type FactMutation = readonly [20 | 21, SymbolId, SymbolId, PageScalar?];
export type ScopeMutation = readonly [22 | 23, SymbolId, PageScalar?];
export type SelectionMutation = readonly [24, SymbolId, readonly SymbolId[]];
export type ActionMutation = readonly [
  30 | 31 | 32 | 33 | 34,
  SymbolId,
  SymbolId,
  SymbolId,
  SymbolId | null,
  ActionArguments,
  SymbolId,
  string,
];
export type ResultMutation = readonly [35 | 36, SymbolId, SymbolId, ActionArguments, string];
export type MeaningMutation = FactMutation | ScopeMutation | SelectionMutation | ActionMutation | ResultMutation;
export type MeaningDelta = readonly [1, SymbolId, number, number, readonly MeaningMutation[]];
export type RendererCapabilities = readonly [1, string, number, number, readonly SymbolId[], number, number, 0 | 1];
export type ActionPolicy = "allow" | "deny" | "approval";
export type ReceiptState = "proposed" | "authorized" | "executing" | "succeeded" | "failed" | "rejected" | "cancelled";
export type ActionReceipt = readonly [
  1,
  SymbolId,
  SymbolId,
  SymbolId,
  SymbolId,
  number,
  string,
  SymbolId,
  SymbolId,
  readonly SymbolId[],
  ActionArguments,
];

export const MeaningOpcode = {
  Header: 0,
  Entity: 1,
  Fact: 2,
  Relation: 3,
  Action: 4,
  Metric: 5,
  Signal: 6,
  Evidence: 7,
  Permission: 8,
} as const;

export const MeaningActionKind = {
  Toggle: 0,
  Number: 1,
  Choice: 2,
  Text: 3,
  Open: 4,
  Copy: 5,
  Emit: 6,
  ScopeChoice: 7,
  Select: 8,
  Inspect: 9,
} as const;

export const MeaningMutationOpcode = {
  SetFact: 20,
  RemoveFact: 21,
  SetScope: 22,
  ClearScope: 23,
  SetSelection: 24,
  InvokeAction: 30,
  ProposeAction: 31,
  ApproveAction: 32,
  RejectAction: 33,
  CancelAction: 34,
  ActionResult: 35,
  ActionFailed: 36,
} as const;

export const InputCapability = { Pointer: 1, Keyboard: 2, Voice: 4, Touch: 8 } as const;
export const LensCapability = { Cards: 1, Table: 2, Flow: 4 } as const;
export const PermissionPolicy = { Allow: 0, Deny: 1, Approval: 2 } as const;
export const ReceiptStateCode = { Proposed: 0, Authorized: 1, Executing: 2, Succeeded: 3, Failed: 4, Rejected: 5, Cancelled: 6 } as const;

export class MeaningProtocolError extends Error {
  constructor(message: string, readonly details: string) {
    super(message);
    this.name = "MeaningProtocolError";
  }
}

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const themes = ["system", "light", "dark"] as const;
const tones = ["neutral", "info", "success", "warning", "danger"] as const;
const affordanceTones = ["neutral", "primary", "success", "warning", "danger"] as const;
const formats = ["auto", "text", "number", "currency", "percent", "date", "datetime", "duration", "url", "email", "phone", "code"] as const;
const displays = ["auto", "prominent", "detail", "hidden"] as const;
const projectionFormats = ["auto", "number", "currency", "percent"] as const;
const policyNames: readonly ActionPolicy[] = ["allow", "deny", "approval"];
const receiptNames: readonly ReceiptState[] = ["proposed", "authorized", "executing", "succeeded", "failed", "rejected", "cancelled"];

function fail(path: string, message: string): never {
  throw new MeaningProtocolError("This meaning packet is invalid.", `${path}: ${message}`);
}

function assertId(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || !idPattern.test(value)) fail(path, "expected an opaque symbol id");
}

function scalar(value: unknown): value is PageScalar {
  return value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value));
}

function pageValue(value: unknown): value is PageValue {
  return scalar(value) || (Array.isArray(value) && value.length <= 50 && value.every(scalar));
}

function scalarRecord(value: unknown): value is ActionArguments {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.values(value as Record<string, unknown>).every(scalar);
}

function textRef(value: unknown): value is MeaningText {
  return Array.isArray(value) && value.length === 2 && (value[0] === 0 || value[0] === 1) && typeof value[1] === "string";
}

function validateRecord(record: MeaningRecord, index: number): void {
  const path = `records[${index}]`;
  if (!Number.isInteger(record[0]) || Number(record[0]) < 0 || Number(record[0]) > 8) fail(path, "invalid opcode tuple");

  if (record[0] === MeaningOpcode.Header) {
    if (!textRef(record[1])) fail(`${path}.title`, "expected a text reference");
    return;
  }
  if (record[0] === MeaningOpcode.Entity) {
    assertId(record[1], `${path}.id`);
    assertId(record[2], `${path}.type`);
    if (!textRef(record[3])) fail(`${path}.name`, "expected a text reference");
    return;
  }
  if (record[0] === MeaningOpcode.Fact) {
    assertId(record[1], `${path}.entity`);
    assertId(record[2], `${path}.property`);
    if (!pageValue(record[3])) fail(`${path}.value`, "expected a page value");
    return;
  }
  if (record[0] === MeaningOpcode.Relation) {
    assertId(record[1], `${path}.from`);
    assertId(record[2], `${path}.to`);
    assertId(record[3], `${path}.kind`);
    return;
  }
  if (record[0] === MeaningOpcode.Action) {
    assertId(record[1], `${path}.id`);
    if (!Number.isInteger(record[2]) || Number(record[2]) < 0 || Number(record[2]) > 9) fail(`${path}.kind`, "unsupported affordance kind");
    if (!textRef(record[3])) fail(`${path}.label`, "expected a text reference");
    if (record[4] !== "page" && record[4] !== null) assertId(record[4], `${path}.target`);
    if (record[9] !== null && record[9] !== undefined) assertId(record[9], `${path}.operation`);
    return;
  }
  if (record[0] === MeaningOpcode.Metric) {
    assertId(record[1], `${path}.id`);
    if (!textRef(record[2])) fail(`${path}.label`, "expected a text reference");
    if (record[3] !== null && record[3] !== undefined) assertId(record[3], `${path}.sourceType`);
    assertId(record[4], `${path}.dimension`);
    if (record[5] !== null && record[5] !== undefined) assertId(record[5], `${path}.measure`);
    if (![0, 1, 2].includes(Number(record[6]))) fail(`${path}.operation`, "expected count, sum, or average");
    if (record[9] !== null && record[9] !== undefined) assertId(record[9], `${path}.affordance`);
    if (record[10] !== undefined && (!Array.isArray(record[10]) || !record[10].every((item) => typeof item === "string" && idPattern.test(item)))) {
      fail(`${path}.ignoreScopes`, "expected scope ids");
    }
    return;
  }
  if (record[0] === MeaningOpcode.Permission) {
    assertId(record[1], `${path}.action`);
    if (![0, 1, 2].includes(Number(record[2]))) fail(`${path}.policy`, "expected allow, deny, or approval");
  }
}

export function validateMeaningPacket(input: unknown): MeaningPacket {
  if (!Array.isArray(input) || input.length !== 6 || input[0] !== 1) fail("root", "expected [1, packetId, revision, vocabularyId, vocabulary, records]");
  assertId(input[1], "packetId");
  if (!Number.isInteger(input[2]) || Number(input[2]) < 0) fail("revision", "expected a non-negative integer");
  if (input[3] !== null) assertId(input[3], "vocabularyId");
  if (!Array.isArray(input[4]) || !Array.isArray(input[5])) fail("root", "vocabulary and records must be arrays");

  const vocabularyIds = new Set<string>();
  for (const [index, entry] of input[4].entries()) {
    if (!Array.isArray(entry) || entry.length !== 2) fail(`vocabulary[${index}]`, "expected [symbol, text]");
    assertId(entry[0], `vocabulary[${index}].symbol`);
    if (typeof entry[1] !== "string") fail(`vocabulary[${index}].text`, "expected text");
    if (vocabularyIds.has(entry[0])) fail(`vocabulary[${index}]`, `duplicate symbol ${entry[0]}`);
    vocabularyIds.add(entry[0]);
  }

  let headers = 0;
  const entityIds = new Set<string>();
  const actionIds = new Set<string>();
  const metricIds = new Set<string>();
  for (const [index, raw] of input[5].entries()) {
    if (!Array.isArray(raw)) fail(`records[${index}]`, "expected an opcode tuple");
    const record = raw as MeaningRecord;
    validateRecord(record, index);
    if (record[0] === MeaningOpcode.Header) headers += 1;
    if (record[0] === MeaningOpcode.Entity) {
      if (entityIds.has(String(record[1]))) fail(`records[${index}].id`, "duplicate entity id");
      entityIds.add(String(record[1]));
    }
    if (record[0] === MeaningOpcode.Action) {
      if (actionIds.has(String(record[1]))) fail(`records[${index}].id`, "duplicate action id");
      actionIds.add(String(record[1]));
    }
    if (record[0] === MeaningOpcode.Metric) {
      if (metricIds.has(String(record[1]))) fail(`records[${index}].id`, "duplicate metric id");
      metricIds.add(String(record[1]));
    }
  }
  if (headers !== 1) fail("records", "exactly one header is required");

  for (const [index, record] of (input[5] as readonly MeaningRecord[]).entries()) {
    if (record[0] === MeaningOpcode.Fact && !entityIds.has(String(record[1]))) fail(`records[${index}].entity`, "unknown entity");
    if (record[0] === MeaningOpcode.Relation && (!entityIds.has(String(record[1])) || !entityIds.has(String(record[2])))) fail(`records[${index}]`, "relationship references an unknown entity");
    if (record[0] === MeaningOpcode.Permission && !actionIds.has(String(record[1]))) fail(`records[${index}].action`, "unknown action");
    if (record[0] === MeaningOpcode.Metric && record[9] !== null && record[9] !== undefined && !actionIds.has(String(record[9]))) fail(`records[${index}].affordance`, "unknown action");
    if (record[0] === MeaningOpcode.Entity && Array.isArray(record[8])) {
      for (const actionId of record[8]) if (!actionIds.has(String(actionId))) fail(`records[${index}].actions`, `unknown action ${String(actionId)}`);
    }
  }
  return input as unknown as MeaningPacket;
}

function words(packet: MeaningPacket): Map<string, string> {
  return new Map(packet[4]);
}

function resolve(value: unknown, dictionary: Map<string, string>, path: string): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (!textRef(value)) fail(path, "expected [0,symbol] or [1,literal]");
  if (value[0] === 1) return value[1];
  const result = dictionary.get(value[1]);
  if (result === undefined) fail(path, `missing vocabulary symbol ${value[1]}`);
  return result;
}

function policyMap(packet: MeaningPacket): Map<string, ActionPolicy> {
  const policies = new Map<string, ActionPolicy>();
  for (const record of packet[5]) if (record[0] === MeaningOpcode.Permission) policies.set(String(record[1]), policyNames[Number(record[2])] ?? "deny");
  return policies;
}

export function actionPolicy(packetInput: unknown, actionId: string): ActionPolicy {
  return policyMap(validateMeaningPacket(packetInput)).get(actionId) ?? "allow";
}

export const DEFAULT_RENDERER_CAPABILITIES: RendererCapabilities = [1, "en-US", 3, 7, ["*"], 1280, 800, 0];

export function browserRendererCapabilities(): RendererCapabilities {
  const width = typeof window === "undefined" ? 1280 : window.innerWidth;
  const height = typeof window === "undefined" ? 800 : window.innerHeight;
  const locale = typeof navigator === "undefined" ? "en-US" : navigator.language || "en-US";
  const touch = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0 ? InputCapability.Touch : 0;
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 1 : 0;
  return [1, locale, InputCapability.Pointer | InputCapability.Keyboard | touch, LensCapability.Cards | LensCapability.Table | LensCapability.Flow, ["*"], width, height, reduced];
}

function supportsOperation(capabilities: RendererCapabilities, operation: unknown): boolean {
  if (operation === null || operation === undefined) return true;
  return capabilities[4].includes("*") || capabilities[4].includes(String(operation));
}

function choiceOptions(record: MeaningRecord, dictionary: Map<string, string>): { label: string; value: PageScalar }[] {
  const config = Array.isArray(record[6]) ? record[6] : [];
  const rows = Array.isArray(config[1]) ? config[1] : [];
  const options = rows.map((option, index) => {
    if (!Array.isArray(option) || option.length !== 2 || !scalar(option[1])) fail(`action.${String(record[1])}.options[${index}]`, "expected [label,scalar]");
    return { label: resolve(option[0], dictionary, "action.option.label")!, value: option[1] as PageScalar };
  });
  if (options.length < 2) fail(`action.${String(record[1])}.options`, "choice affordances need at least two options");
  return options;
}

function ownerMap(records: readonly MeaningRecord[]): Map<string, string[]> {
  const owners = new Map<string, string[]>();
  for (const record of records) {
    if (record[0] !== MeaningOpcode.Entity || !Array.isArray(record[8])) continue;
    for (const actionId of record[8]) owners.set(String(actionId), [...(owners.get(String(actionId)) ?? []), String(record[1])]);
  }
  return owners;
}

function targetsFor(record: MeaningRecord, owners: Map<string, string[]>): Array<"page" | string> {
  if (record[4] === "page") return ["page"];
  if (typeof record[4] === "string") return [record[4]];
  const owned = owners.get(String(record[1])) ?? [];
  return owned.length ? owned : ["page"];
}

function makeAffordance(record: MeaningRecord, dictionary: Map<string, string>, policy: Exclude<ActionPolicy, "deny">): PageAffordance {
  const id = String(record[1]);
  const label = resolve(record[3], dictionary, "action.label")!;
  const description = resolve(record[8], dictionary, "action.description");
  const tone = policy === "approval" ? "warning" : affordanceTones[Number(record[7])] ?? "neutral";
  const kind = Number(record[2]);
  const base = { id, label, description, tone } as const;
  if (policy === "approval") {
    return { ...base, effect: { kind: "invoke", operation: String(record[9] ?? id), policy: "approval" }, input: { kind: "none" } };
  }
  if (kind === MeaningActionKind.Toggle) return { ...base, effect: { kind: "set", field: String(record[5]) }, input: { kind: "boolean" } };
  if (kind === MeaningActionKind.Number) {
    const config = Array.isArray(record[6]) ? record[6] : [];
    return {
      ...base,
      effect: { kind: "set", field: String(record[5]) },
      input: {
        kind: "number",
        min: typeof config[1] === "number" ? config[1] : undefined,
        max: typeof config[2] === "number" ? config[2] : undefined,
        step: typeof config[3] === "number" && config[3] > 0 ? config[3] : undefined,
        presentation: config[4] === "adjust" || (typeof config[1] === "number" && typeof config[2] === "number") ? "adjust" : "entry",
      },
    };
  }
  if (kind === MeaningActionKind.Choice) return { ...base, effect: { kind: "set", field: String(record[5]) }, input: { kind: "choice", options: choiceOptions(record, dictionary) } };
  if (kind === MeaningActionKind.Text) {
    const config = Array.isArray(record[6]) ? record[6] : [];
    return {
      ...base,
      effect: { kind: "set", field: String(record[5]) },
      input: { kind: "text", placeholder: resolve(config[1], dictionary, "action.placeholder"), multiline: Boolean(config[2]) },
    };
  }
  if (kind === MeaningActionKind.Open) return { ...base, effect: { kind: "navigate", url: String(record[5] ?? record[4]) }, input: { kind: "none" } };
  if (kind === MeaningActionKind.Copy) {
    const config = Array.isArray(record[6]) ? record[6] : [];
    const source = ["page", "object", "field", "url"][Number(config[0])] as "page" | "object" | "field" | "url" | undefined;
    return {
      ...base,
      effect: {
        kind: "copy",
        source: source ?? "object",
        field: source === "field" && config[2] ? String(config[2]) : undefined,
        url: source === "url" && typeof config[1] === "string" ? config[1] : undefined,
      },
      input: { kind: "none" },
    };
  }
  if (kind === MeaningActionKind.ScopeChoice) return { ...base, effect: { kind: "scope", scope: String(record[5]) }, input: { kind: "choice", options: choiceOptions(record, dictionary) } };
  if (kind === MeaningActionKind.Select) {
    const config = Array.isArray(record[6]) ? record[6] : [];
    return { ...base, effect: { kind: "select", selection: String(record[5]), mode: config[0] === "multiple" ? "multiple" : "single" }, input: { kind: "none" } };
  }
  if (kind === MeaningActionKind.Inspect) return { ...base, effect: { kind: "inspect" }, input: { kind: "none" } };
  return { ...base, effect: { kind: "invoke", operation: String(record[9] ?? id), policy: "allow" }, input: { kind: "none" } };
}

function bindingTarget(affordance: PageAffordance, target: "page" | string): PageBinding["target"] {
  if (target === "page") return { kind: "page" };
  return affordance.effect.kind === "set"
    ? { kind: "field", object: target, field: affordance.effect.field }
    : { kind: "object", object: target };
}

export function materializeMeaningPacket(input: unknown, capabilities: RendererCapabilities = DEFAULT_RENDERER_CAPABILITIES): JuanPageDocument {
  const packet = validateMeaningPacket(input);
  const dictionary = words(packet);
  const records = packet[5];
  const header = records.find((record) => record[0] === MeaningOpcode.Header)!;
  const policies = policyMap(packet);
  const facts = new Map<string, MeaningRecord[]>();
  for (const record of records) if (record[0] === MeaningOpcode.Fact) facts.set(String(record[1]), [...(facts.get(String(record[1])) ?? []), record]);

  const owners = ownerMap(records);
  const affordances: PageAffordance[] = [];
  const bindings: PageBinding[] = [];
  const scopes: NonNullable<JuanPageDocument["scopes"]> = [];
  const enabledActionIds = new Set<string>();
  const metadata: Record<string, PageScalar> = {
    "m1.packetId": packet[1],
    "m1.revision": packet[2],
    "m1.vocabularyId": packet[3],
    "m1.locale": capabilities[1],
    "m1.records": records.length,
  };

  for (const record of records.filter((item) => item[0] === MeaningOpcode.Action)) {
    const actionId = String(record[1]);
    const policy = policies.get(actionId) ?? "allow";
    const supported = supportsOperation(capabilities, record[9]);
    metadata[`m1.policy.${actionId}`] = supported ? policy : "deny";
    if (record[9] !== null && record[9] !== undefined) metadata[`m1.operation.${actionId}`] = String(record[9]);
    metadata[`m1.kind.${actionId}`] = Number(record[2]);
    if (policy === "deny" || !supported) continue;
    const affordance = makeAffordance(record, dictionary, policy);
    affordances.push(affordance);
    enabledActionIds.add(actionId);
    if (affordance.effect.kind === "scope") {
      const config = Array.isArray(record[6]) ? record[6] : [];
      scopes.push({
        id: affordance.effect.scope,
        label: affordance.label,
        field: typeof config[2] === "string" ? config[2] : affordance.effect.scope,
        initial: scalar(config[0]) ? config[0] : undefined,
      });
    }
    targetsFor(record, owners).forEach((target, index) => {
      bindings.push({ id: `binding:${actionId}:${index}`, target: bindingTarget(affordance, target), affordance: actionId, priority: index === 0 ? "primary" : "secondary" });
    });
  }

  const objects: JuanPageDocument["objects"] = records
    .filter((record) => record[0] === MeaningOpcode.Entity)
    .map((record) => ({
      id: String(record[1]),
      type: dictionary.get(String(record[2])) ?? String(record[2]),
      name: resolve(record[3], dictionary, "entity.name")!,
      group: resolve(record[4], dictionary, "entity.group"),
      status: resolve(record[5], dictionary, "entity.status"),
      tone: tones[Number(record[6])] ?? "neutral",
      summary: resolve(record[7], dictionary, "entity.summary"),
      tags: Array.isArray(record[9]) ? record[9].map((tag) => resolve(tag, dictionary, "entity.tag")!) : undefined,
      fields: (facts.get(String(record[1])) ?? []).map((fact) => ({
        key: String(fact[2]),
        label: resolve(fact[4], dictionary, "fact.label") ?? dictionary.get(String(fact[2])),
        value: fact[3] as PageValue,
        format: formats[Number(fact[5])] ?? "auto",
        display: displays[Number(fact[6])] ?? "auto",
        currency: fact[7] ? String(fact[7]) : undefined,
      })),
    }));

  for (const record of records.filter((item) => item[0] === MeaningOpcode.Signal)) {
    objects.push({
      id: String(record[1]),
      type: "signal",
      name: resolve(record[4], dictionary, "signal.reason")!,
      group: "Signals",
      status: `${Math.round(Number(record[3]) * 100)}% severity`,
      tone: Number(record[3]) >= 0.8 ? "danger" : "warning",
      summary: resolve(record[6], dictionary, "signal.source"),
      tags: [`target:${String(record[2])}`],
      fields: [
        { key: "severity", value: Number(record[3]), format: "percent", display: "prominent" },
        { key: "confidence", value: Number(record[5]), format: "percent" },
      ],
    });
  }

  for (const record of records.filter((item) => item[0] === MeaningOpcode.Evidence)) {
    objects.push({
      id: String(record[1]),
      type: "evidence",
      name: resolve(record[3], dictionary, "evidence.source")!,
      group: "Evidence",
      status: `${Math.round(Number(record[5]) * 100)}% confidence`,
      tone: "info",
      summary: resolve(record[4], dictionary, "evidence.claim"),
      tags: [`target:${String(record[2])}`],
    });
  }

  for (const record of records.filter((item) => item[0] === MeaningOpcode.Permission)) {
    const policy = policyNames[Number(record[2])] ?? "deny";
    objects.push({
      id: `policy:${String(record[1])}`,
      type: "permission",
      name: policy === "allow" ? "Allowed" : policy === "deny" ? "Denied" : "Human approval required",
      group: "Trust",
      status: policy === "allow" ? "Allow" : policy === "deny" ? "Deny" : "Approval",
      tone: policy === "deny" ? "danger" : policy === "approval" ? "warning" : "success",
      summary: resolve(record[3], dictionary, "permission.reason"),
      tags: [`affordance:${String(record[1])}`],
    });
  }

  const relations = records
    .filter((record) => record[0] === MeaningOpcode.Relation)
    .map((record, index) => ({
      id: `relation:${index}:${String(record[1])}:${String(record[2])}`,
      from: String(record[1]),
      to: String(record[2]),
      kind: String(record[3]),
      label: resolve(record[4], dictionary, "relation.label") ?? dictionary.get(String(record[3])),
    }));

  const projections: NonNullable<JuanPageDocument["projections"]> = [];
  for (const record of records.filter((item) => item[0] === MeaningOpcode.Metric)) {
    const operation = ["count", "sum", "average"][Number(record[6])] as "count" | "sum" | "average";
    const projection = {
      id: String(record[1]),
      label: resolve(record[2], dictionary, "projection.label")!,
      sourceType: record[3] ? dictionary.get(String(record[3])) ?? String(record[3]) : undefined,
      dimension: String(record[4]),
      operation,
      measure: operation === "count" ? undefined : String(record[5]),
      format: projectionFormats[Number(record[7])] ?? "auto",
      currency: record[8] ? String(record[8]) : undefined,
      ignoreScopes: Array.isArray(record[10]) ? record[10].map(String) : undefined,
    } as NonNullable<JuanPageDocument["projections"]>[number];
    projections.push(projection);
    const actionId = record[9] ? String(record[9]) : undefined;
    if (actionId && enabledActionIds.has(actionId)) {
      bindings.push({ id: `binding:${actionId}:projection:${projection.id}`, target: { kind: "projection", projection: projection.id }, affordance: actionId, priority: "primary" });
    }
  }

  return validatePage({
    version: "2.0",
    title: resolve(header[1], dictionary, "header.title")!,
    intent: resolve(header[2], dictionary, "header.intent"),
    description: resolve(header[3], dictionary, "header.description"),
    theme: themes[Number(header[4])] ?? "system",
    objects,
    relations,
    scopes: scopes.length ? scopes : undefined,
    projections: projections.length ? projections : undefined,
    affordances: affordances.length ? affordances : undefined,
    bindings: bindings.length ? bindings : undefined,
    state: scopes.length
      ? { scopes: Object.fromEntries(scopes.filter((scope) => scope.initial !== undefined).map((scope) => [scope.id, scope.initial!])) }
      : undefined,
    metadata,
  });
}

export function createFactDelta(packetId: string, baseRevision: number, target: string, property: string, value: PageScalar): MeaningDelta {
  return [1, packetId, baseRevision, baseRevision + 1, [[MeaningMutationOpcode.SetFact, target, property, value]]];
}

export function createScopeDelta(packetId: string, baseRevision: number, scope: string, value: PageScalar): MeaningDelta {
  assertId(packetId, "packetId");
  assertId(scope, "scope");
  return value === null
    ? [1, packetId, baseRevision, baseRevision + 1, [[MeaningMutationOpcode.ClearScope, scope]]]
    : [1, packetId, baseRevision, baseRevision + 1, [[MeaningMutationOpcode.SetScope, scope, value]]];
}

export function createSelectionDelta(packetId: string, baseRevision: number, selection: string, values: readonly string[]): MeaningDelta {
  assertId(packetId, "packetId");
  assertId(selection, "selection");
  values.forEach((value, index) => assertId(value, `selection.values[${index}]`));
  return [1, packetId, baseRevision, baseRevision + 1, [[MeaningMutationOpcode.SetSelection, selection, [...values]]]];
}

export function createActionDelta(
  packetId: string,
  baseRevision: number,
  actorId: string,
  actionId: string,
  target: string | null,
  args: ActionArguments = {},
  policy: ActionPolicy = "allow",
  options: { mutationId?: string; idempotencyKey?: string; timestamp?: string } = {},
): MeaningDelta {
  assertId(packetId, "packetId");
  assertId(actorId, "actorId");
  assertId(actionId, "actionId");
  if (target !== null) assertId(target, "target");
  if (!scalarRecord(args)) fail("action.args", "expected an object containing scalar values");
  if (policy === "deny") fail("action.policy", "denied actions cannot produce an invocation");
  const nextRevision = baseRevision + 1;
  const mutationId = options.mutationId ?? `mut:${actionId}:${nextRevision}`;
  const idempotencyKey = options.idempotencyKey ?? `idem:${packetId}:${nextRevision}:${actionId}`;
  const timestamp = options.timestamp ?? new Date().toISOString();
  assertId(mutationId, "mutationId");
  assertId(idempotencyKey, "idempotencyKey");
  const opcode = policy === "approval" ? MeaningMutationOpcode.ProposeAction : MeaningMutationOpcode.InvokeAction;
  return [1, packetId, baseRevision, nextRevision, [[opcode, mutationId, actorId, actionId, target, args, idempotencyKey, timestamp]]];
}

export function createActionReceipt(
  deltaInput: unknown,
  state: ReceiptState,
  result: ActionArguments = {},
  evidence: readonly string[] = [],
): ActionReceipt {
  const delta = validateMeaningDelta(deltaInput);
  const mutation = delta[4].find((item): item is ActionMutation => item[0] >= 30 && item[0] <= 34);
  if (!mutation) fail("receipt", "the delta does not contain an action mutation");
  if (!scalarRecord(result)) fail("receipt.result", "expected scalar result values");
  evidence.forEach((value, index) => assertId(value, `receipt.evidence[${index}]`));
  const code = receiptNames.indexOf(state);
  if (code < 0) fail("receipt.state", "unsupported receipt state");
  return [1, `receipt:${mutation[1]}:${code}`, delta[1], mutation[3], mutation[1], code, new Date().toISOString(), mutation[6], mutation[2], evidence, result];
}

export function validateActionReceipt(input: unknown): ActionReceipt {
  if (!Array.isArray(input) || input.length !== 11 || input[0] !== 1) fail("receipt", "expected an M1 action receipt tuple");
  assertId(input[1], "receipt.id");
  assertId(input[2], "receipt.packetId");
  assertId(input[3], "receipt.actionId");
  assertId(input[4], "receipt.mutationId");
  if (!Number.isInteger(input[5]) || Number(input[5]) < 0 || Number(input[5]) > 6) fail("receipt.state", "unsupported state");
  if (typeof input[6] !== "string" || Number.isNaN(Date.parse(input[6]))) fail("receipt.timestamp", "expected an ISO timestamp");
  assertId(input[7], "receipt.idempotencyKey");
  assertId(input[8], "receipt.actorId");
  if (!Array.isArray(input[9])) fail("receipt.evidence", "expected evidence ids");
  input[9].forEach((value, index) => assertId(value, `receipt.evidence[${index}]`));
  if (!scalarRecord(input[10])) fail("receipt.result", "expected scalar result values");
  return input as unknown as ActionReceipt;
}

export function validateMeaningDelta(input: unknown): MeaningDelta {
  if (!Array.isArray(input) || input.length !== 5 || input[0] !== 1) fail("delta", "expected [1, packetId, baseRevision, nextRevision, mutations]");
  assertId(input[1], "delta.packetId");
  if (!Number.isInteger(input[2]) || !Number.isInteger(input[3]) || Number(input[3]) <= Number(input[2]) || !Array.isArray(input[4])) fail("delta", "invalid revision or mutation list");
  for (const [index, raw] of input[4].entries()) {
    if (!Array.isArray(raw)) fail(`delta.mutations[${index}]`, "expected a tuple");
    const opcode = Number(raw[0]);
    if (opcode === MeaningMutationOpcode.SetFact || opcode === MeaningMutationOpcode.RemoveFact) {
      assertId(raw[1], `delta.mutations[${index}].target`);
      assertId(raw[2], `delta.mutations[${index}].property`);
      if (opcode === MeaningMutationOpcode.SetFact && !scalar(raw[3])) fail(`delta.mutations[${index}].value`, "expected a scalar");
      continue;
    }
    if (opcode === MeaningMutationOpcode.SetScope || opcode === MeaningMutationOpcode.ClearScope) {
      assertId(raw[1], `delta.mutations[${index}].scope`);
      if (opcode === MeaningMutationOpcode.SetScope && !scalar(raw[2])) fail(`delta.mutations[${index}].value`, "expected a scalar");
      continue;
    }
    if (opcode === MeaningMutationOpcode.SetSelection) {
      assertId(raw[1], `delta.mutations[${index}].selection`);
      if (!Array.isArray(raw[2])) fail(`delta.mutations[${index}].values`, "expected ids");
      raw[2].forEach((value, valueIndex) => assertId(value, `delta.mutations[${index}].values[${valueIndex}]`));
      continue;
    }
    if (opcode >= MeaningMutationOpcode.InvokeAction && opcode <= MeaningMutationOpcode.CancelAction) {
      if (raw.length !== 8) fail(`delta.mutations[${index}]`, "invalid action mutation tuple");
      assertId(raw[1], `delta.mutations[${index}].mutationId`);
      assertId(raw[2], `delta.mutations[${index}].actorId`);
      assertId(raw[3], `delta.mutations[${index}].actionId`);
      if (raw[4] !== null) assertId(raw[4], `delta.mutations[${index}].target`);
      if (!scalarRecord(raw[5])) fail(`delta.mutations[${index}].args`, "expected scalar arguments");
      assertId(raw[6], `delta.mutations[${index}].idempotencyKey`);
      if (typeof raw[7] !== "string" || Number.isNaN(Date.parse(raw[7]))) fail(`delta.mutations[${index}].timestamp`, "expected an ISO timestamp");
      continue;
    }
    if (opcode === MeaningMutationOpcode.ActionResult || opcode === MeaningMutationOpcode.ActionFailed) {
      if (raw.length !== 5) fail(`delta.mutations[${index}]`, "invalid result mutation tuple");
      assertId(raw[1], `delta.mutations[${index}].mutationId`);
      assertId(raw[2], `delta.mutations[${index}].actionId`);
      if (!scalarRecord(raw[3])) fail(`delta.mutations[${index}].result`, "expected scalar result values");
      if (typeof raw[4] !== "string" || Number.isNaN(Date.parse(raw[4]))) fail(`delta.mutations[${index}].timestamp`, "expected an ISO timestamp");
      continue;
    }
    fail(`delta.mutations[${index}]`, `unsupported mutation opcode ${opcode}`);
  }
  return input as unknown as MeaningDelta;
}

export function interactionStateFromMeaningDeltas(deltas: readonly MeaningDelta[]): PageInteractionState {
  const scopes: Record<string, PageScalar> = {};
  const selections: Record<string, string[]> = {};
  for (const delta of deltas.map(validateMeaningDelta)) {
    for (const mutation of delta[4]) {
      if (mutation[0] === MeaningMutationOpcode.SetScope) scopes[mutation[1]] = mutation[2] as PageScalar;
      if (mutation[0] === MeaningMutationOpcode.ClearScope) delete scopes[mutation[1]];
      if (mutation[0] === MeaningMutationOpcode.SetSelection) selections[mutation[1]] = [...mutation[2]];
    }
  }
  return { scopes, selections };
}

export function applyMeaningDelta(packetInput: unknown, deltaInput: unknown): MeaningPacket {
  const packet = validateMeaningPacket(packetInput);
  const delta = validateMeaningDelta(deltaInput);
  if (packet[1] !== delta[1] || packet[2] !== delta[2]) fail("delta", "packet id or base revision mismatch");
  let records = [...packet[5]];
  for (const mutation of delta[4]) {
    if (mutation[0] === MeaningMutationOpcode.SetFact) {
      let found = false;
      records = records.map((record) =>
        record[0] === MeaningOpcode.Fact && record[1] === mutation[1] && record[2] === mutation[2]
          ? ((found = true), [MeaningOpcode.Fact, mutation[1], mutation[2], mutation[3], record[4], record[5], record[6], record[7]])
          : record,
      );
      if (!found) records.push([MeaningOpcode.Fact, mutation[1], mutation[2], mutation[3], [1, mutation[2]], 0, 0, null]);
    } else if (mutation[0] === MeaningMutationOpcode.RemoveFact) {
      records = records.filter((record) => !(record[0] === MeaningOpcode.Fact && record[1] === mutation[1] && record[2] === mutation[2]));
    }
  }
  return [1, packet[1], delta[3], packet[3], packet[4], records];
}

export const meaningRef = (symbol: SymbolId): MeaningText => [0, symbol];
export const meaningLiteral = (value: string): MeaningText => [1, value];
