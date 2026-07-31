import type { JuanPageDocument, PageAction, PageObject } from "../schema/page.js";

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
    actions: object.actionIds ?? [],
  };
}

function actionModel(action: PageAction): Readonly<Record<string, unknown>> {
  return {
    id: action.id,
    kind: action.kind,
    label: action.label,
    target: "target" in action ? action.target : undefined,
  };
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
    },
    components: page.objects.map((object) => ({
      id: `component:${object.id}`,
      component: "adaptive-object",
      bind: `/objects/${object.id}`,
      actions: object.actionIds ?? [],
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
        actions: (page.actions ?? []).map(actionModel),
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
