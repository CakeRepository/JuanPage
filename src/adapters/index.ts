import type { JuanPageDocument, PageAffordance, PageBinding, PageObject } from "../schema/page.js";

export type A2UIBridgeModel = Readonly<{
  protocol: "a2ui-bridge";
  surfaceId: string;
  title: string;
  dataModel: Readonly<Record<string, unknown>>;
  components: readonly Readonly<Record<string, unknown>>[];
}>;

export type AGUIBridgeEvent = Readonly<{
  type: "STATE_SNAPSHOT" | "TOOL_CALL_START";
  messageId: string;
  payload: unknown;
}>;

export type McpAppResource = Readonly<{
  uri: string;
  name: string;
  mimeType: "application/vnd.juanpager+json";
  text: string;
}>;

function objectModel(object: PageObject): Readonly<Record<string, unknown>> {
  return {
    id: object.id,
    type: object.type,
    name: object.name,
    status: object.status,
    group: object.group,
    fields: Object.fromEntries((object.fields ?? []).map((field) => [field.key, field.value])),
  };
}

function affordanceModel(affordance: PageAffordance): Readonly<Record<string, unknown>> {
  return {
    id: affordance.id,
    label: affordance.label,
    effect: affordance.effect,
    input: affordance.input,
    tone: affordance.tone,
  };
}

function bindingsForObject(page: JuanPageDocument, objectId: string): PageBinding[] {
  return (page.bindings ?? []).filter((binding) =>
    (binding.target.kind === "object" || binding.target.kind === "field")
    && binding.target.object === objectId,
  );
}

export function toA2UIBridge(page: JuanPageDocument, surfaceId = "juanpager"): A2UIBridgeModel {
  return {
    protocol: "a2ui-bridge",
    surfaceId,
    title: page.title,
    dataModel: {
      intent: page.intent,
      objects: Object.fromEntries(page.objects.map((object) => [object.id, objectModel(object)])),
      relations: page.relations ?? [],
      metrics: page.metrics ?? [],
      projections: page.projections ?? [],
      scopes: page.scopes ?? [],
      state: page.state ?? {},
      affordances: Object.fromEntries((page.affordances ?? []).map((affordance) => [affordance.id, affordanceModel(affordance)])),
      bindings: page.bindings ?? [],
    },
    components: page.objects.map((object) => ({
      id: `component:${object.id}`,
      component: "adaptive-object",
      bind: `/objects/${object.id}`,
      bindings: bindingsForObject(page, object.id),
    })),
  };
}

export function toAGUIBridgeEvents(page: JuanPageDocument): readonly AGUIBridgeEvent[] {
  return [
    {
      type: "STATE_SNAPSHOT",
      messageId: `snapshot:${String(page.metadata?.["m1.packetId"] ?? "juanpage")}:${String(page.metadata?.["m1.revision"] ?? 0)}`,
      payload: {
        version: page.version,
        title: page.title,
        objects: page.objects.map(objectModel),
        relations: page.relations ?? [],
        metrics: page.metrics ?? [],
        projections: page.projections ?? [],
        scopes: page.scopes ?? [],
        state: page.state ?? {},
        affordances: (page.affordances ?? []).map(affordanceModel),
        bindings: page.bindings ?? [],
      },
    },
  ];
}

export function toMcpAppResource(page: JuanPageDocument, uri = "ui://juanpager/current"): McpAppResource {
  return {
    uri,
    name: page.title,
    mimeType: "application/vnd.juanpager+json",
    text: JSON.stringify(page),
  };
}
