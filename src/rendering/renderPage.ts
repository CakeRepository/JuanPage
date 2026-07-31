import { announce, append, el, externalLink, imageWithFallback } from "./dom.js";
import { applyTheme, type RenderHandle } from "./render.js";
import { humanizeKey, objectField, pageObject, type JuanPageDocument, type PageAction, type PageField, type PageLens, type PageMetric, type PageObject, type PageScalar } from "../schema/page.js";
import { effectiveFieldValue, loadPageState, pageStateKey, resetPageState, savePageState, setPageValue, type PageState } from "../state/pageState.js";

export type UniversalRenderOptions = { builderHref?: string; onShare?: () => string | Promise<string> };

function scalarText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.map(scalarText).join(" · ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
function formatValue(value: unknown, field?: PageField): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.map(scalarText).join(" · ");
  if (typeof value === "number") {
    if (field?.format === "currency") return new Intl.NumberFormat("en-US", { style: "currency", currency: field.currency ?? "USD" }).format(value);
    if (field?.format === "percent") return `${Math.round(value * 100)}%`;
    return new Intl.NumberFormat("en-US").format(value);
  }
  if (field?.format === "date" || field?.format === "datetime") {
    const date = new Date(String(value));
    if (!Number.isNaN(date.valueOf())) return field.format === "date" ? date.toLocaleDateString() : date.toLocaleString();
  }
  return scalarText(value);
}
function objectValue(object: PageObject, field: string, state: PageState): unknown {
  if (field === "id") return object.id;
  if (field === "name") return object.name;
  if (field === "type") return object.type;
  if (field === "group") return object.group;
  if (field === "status") return object.status;
  return effectiveFieldValue(object, field, state);
}
function matchesFilter(object: PageObject, metric: PageMetric, state: PageState): boolean {
  if (!("filter" in metric) || !metric.filter) return true;
  return objectValue(object, metric.filter.field, state) === metric.filter.equals;
}
function metricValue(metric: PageMetric, page: JuanPageDocument, state: PageState): string {
  const objects = page.objects.filter((object) => matchesFilter(object, metric, state));
  let value: PageScalar = 0;
  if (metric.operation === "value") value = metric.value;
  if (metric.operation === "count") value = objects.length;
  if (metric.operation === "sum") value = objects.reduce((total, object) => total + (typeof objectValue(object, metric.field, state) === "number" ? Number(objectValue(object, metric.field, state)) : 0), 0);
  if (metric.operation === "sum-product") value = objects.reduce((total, object) => { const left = objectValue(object, metric.leftField, state); const right = objectValue(object, metric.rightField, state); return total + (typeof left === "number" ? left : 0) * (typeof right === "number" ? right : 0); }, 0);
  if (metric.operation === "progress") { const done = objects.filter((object) => Boolean(objectValue(object, metric.field, state))).length; value = objects.length ? done / objects.length : 0; }
  if (typeof value === "number" && metric.format === "currency") return new Intl.NumberFormat("en-US", { style: "currency", currency: metric.currency ?? "USD" }).format(value);
  if (typeof value === "number" && metric.format === "percent") return `${Math.round(value * 100)}%`;
  return typeof value === "number" ? new Intl.NumberFormat("en-US").format(value) : scalarText(value);
}
function objectText(object: PageObject, state: PageState): string {
  return [object.name, object.type, object.group, object.status, object.summary, ...(object.tags ?? []), ...(object.fields ?? []).flatMap((field) => [field.label, scalarText(objectValue(object, field.key, state))])].filter(Boolean).join(" ").toLowerCase();
}
function copyObject(object: PageObject, state: PageState): string {
  const lines = [object.name, object.summary ?? ""];
  for (const field of object.fields ?? []) if (field.display !== "hidden") lines.push(`${field.label ?? humanizeKey(field.key)}: ${formatValue(objectValue(object, field.key, state), field)}`);
  return lines.filter(Boolean).join("\n");
}

export function renderPage(page: JuanPageDocument, mount: HTMLElement, options: UniversalRenderOptions = {}): RenderHandle {
  applyTheme(page.theme); document.title = `${page.title} · JuanPager`;
  const key = pageStateKey(page); const state = loadPageState(key); const actionMap = new Map((page.actions ?? []).map((action) => [action.id, action])); let query = "";
  const persist = (): void => savePageState(key, state);
  const setLens = (lens: PageLens): void => { state.lens = lens; persist(); draw(); };

  const runCopy = async (action: Extract<PageAction, { kind: "copy" }>, object?: PageObject): Promise<void> => {
    let text = window.location.href;
    if (action.source === "page") text = JSON.stringify(page, null, 2);
    if (action.source === "object" && object) text = copyObject(object, state);
    if (action.source === "field" && action.target && action.field) { const target = pageObject(page, action.target); if (target) text = scalarText(objectValue(target, action.field, state)); }
    await navigator.clipboard.writeText(text);
  };

  const actionControl = (action: PageAction, object?: PageObject): HTMLElement => {
    const target = "target" in action ? action.target : undefined;
    const targetObject = target && target !== "page" ? pageObject(page, target) : object;
    const host = el("div", { className: "jp-u-action" });
    if (action.kind === "open") return externalLink(action.url, action.label, `jp-u-button jp-u-${action.tone ?? "neutral"}`);
    if (action.kind === "copy" || action.kind === "emit") {
      const button = el("button", { className: `jp-u-button jp-u-${action.tone ?? "neutral"}`, text: action.label, attrs: { type: "button" } });
      button.addEventListener("click", () => { void (async () => { if (action.kind === "copy") await runCopy(action, object); else await navigator.clipboard.writeText(JSON.stringify({ version: "1.0", page: page.title, updatedAt: new Date().toISOString(), values: state.values }, null, 2)); announce(host, "Copied"); })(); });
      return button;
    }
    if (!targetObject || !("field" in action)) return host;
    const label = el("label", { className: "jp-u-action-label" }); append(label, el("span", { text: action.label }));
    const current = effectiveFieldValue(targetObject, action.field, state, "initial" in action ? action.initial : undefined);
    if (action.kind === "toggle") {
      const input = el("input", { attrs: { type: "checkbox" } }) as HTMLInputElement; input.checked = Boolean(current);
      input.addEventListener("change", () => { setPageValue(state, targetObject.id, action.field, input.checked); persist(); draw(); }); append(label, input);
    } else if (action.kind === "number") {
      const input = el("input", { attrs: { type: "number", value: String(current ?? action.initial ?? 0), min: action.min, max: action.max, step: action.step ?? 1 } }) as HTMLInputElement;
      input.addEventListener("change", () => { let next = Number(input.value); if (!Number.isFinite(next)) next = action.initial ?? 0; if (action.min !== undefined) next = Math.max(action.min, next); if (action.max !== undefined) next = Math.min(action.max, next); setPageValue(state, targetObject.id, action.field, next); persist(); draw(); }); append(label, input);
    } else if (action.kind === "choice") {
      const select = el("select") as HTMLSelectElement; for (const option of action.options) append(select, el("option", { text: option.label, attrs: { value: option.value } })); select.value = String(current ?? action.initial ?? action.options[0].value);
      select.addEventListener("change", () => { setPageValue(state, targetObject.id, action.field, select.value); persist(); draw(); }); append(label, select);
    } else if (action.kind === "text") {
      const input = action.multiline ? el("textarea", { attrs: { placeholder: action.placeholder ?? "" } }) as HTMLTextAreaElement : el("input", { attrs: { type: "text", placeholder: action.placeholder ?? "" } }) as HTMLInputElement;
      input.value = String(current ?? action.initial ?? ""); input.addEventListener("change", () => { setPageValue(state, targetObject.id, action.field, input.value); persist(); draw(); }); append(label, input);
    }
    append(host, label); return host;
  };

  const visible = (): PageObject[] => page.objects.filter((object) => {
    const groupBy = page.view?.groupBy ?? "group";
    const group = groupBy === "type" ? object.type : groupBy === "status" ? object.status : object.group;
    return (!query || objectText(object, state).includes(query)) && (!state.activeGroup || state.activeGroup === "all" || group === state.activeGroup);
  });

  const card = (object: PageObject): HTMLElement => {
    const article = el("article", { className: `jp-u-card jp-u-tone-${object.tone ?? "neutral"}`, attrs: { "data-object-id": object.id, tabindex: "0" } });
    if (object.imageUrl) append(article, imageWithFallback(object.imageUrl, object.name, "jp-u-image"));
    const head = el("div", { className: "jp-u-card-head" }); append(head, el("span", { className: "jp-u-type", text: humanizeKey(object.type) })); if (object.status) append(head, el("span", { className: "jp-u-status", text: object.status }));
    append(article, head, el("h3", { text: object.name })); if (object.summary) append(article, el("p", { className: "jp-u-summary", text: object.summary }));
    const prominent = (object.fields ?? []).filter((field) => field.display === "prominent"); if (prominent.length) { const row = el("div", { className: "jp-u-prominent" }); for (const field of prominent) append(row, el("div", { text: formatValue(objectValue(object, field.key, state), field) })); append(article, row); }
    const open = (): void => { state.selectedId = object.id; persist(); draw(); };
    article.addEventListener("click", (event) => { if (!(event.target as Element).closest("button,a,input,select,textarea,label")) open(); }); article.addEventListener("keydown", (event) => { if (event.key === "Enter") open(); }); return article;
  };

  const cardsLens = (objects: PageObject[]): HTMLElement => {
    const body = el("div", { className: "jp-u-groups" }); const groupBy = page.view?.groupBy ?? "group";
    if (groupBy === "none") { const grid = el("div", { className: "jp-u-grid" }); for (const object of objects) append(grid, card(object)); append(body, grid); return body; }
    const buckets = new Map<string, PageObject[]>(); for (const object of objects) { const name = groupBy === "type" ? object.type : groupBy === "status" ? object.status ?? "No status" : object.group ?? "Other"; buckets.set(name, [...(buckets.get(name) ?? []), object]); }
    for (const [name, items] of buckets) { const section = el("section", { className: "jp-u-group" }); append(section, el("h2", { text: name }), el("span", { className: "jp-u-count", text: String(items.length) })); const grid = el("div", { className: "jp-u-grid" }); for (const object of items) append(grid, card(object)); append(section, grid); append(body, section); } return body;
  };

  const tableLens = (objects: PageObject[]): HTMLElement => {
    const wrap = el("div", { className: "jp-u-table-wrap" }); const table = el("table", { className: "jp-u-table" }); const keys = [...new Set(objects.flatMap((object) => (object.fields ?? []).filter((field) => field.display !== "hidden").map((field) => field.key)))].slice(0, 8);
    const head = el("thead"); const headRow = el("tr"); for (const label of ["Name", "Type", "Status", ...keys.map(humanizeKey)]) append(headRow, el("th", { text: label })); append(head, headRow); table.append(head);
    const body = el("tbody"); for (const object of objects) { const row = el("tr", { attrs: { "data-object-id": object.id, tabindex: "0" } }); append(row, el("th", { text: object.name }), el("td", { text: humanizeKey(object.type) }), el("td", { text: object.status ?? "—" })); for (const fieldKey of keys) append(row, el("td", { text: formatValue(objectValue(object, fieldKey, state), objectField(object, fieldKey)) })); row.addEventListener("click", () => { state.selectedId = object.id; persist(); draw(); }); append(body, row); } append(table, body); wrap.append(table); return wrap;
  };

  const flowLens = (objects: PageObject[]): HTMLElement => {
    const ids = new Set(objects.map((object) => object.id)); const root = el("div", { className: "jp-u-flow" }); const lanes = new Map<string, PageObject[]>();
    for (const object of objects) lanes.set(object.group ?? humanizeKey(object.type), [...(lanes.get(object.group ?? humanizeKey(object.type)) ?? []), object]);
    for (const [name, items] of lanes) { const lane = el("section", { className: "jp-u-lane" }); append(lane, el("h2", { text: name })); for (const object of items) append(lane, card(object)); append(root, lane); }
    const relations = (page.relations ?? []).filter((relation) => ids.has(relation.from) && ids.has(relation.to)); if (relations.length) { const list = el("section", { className: "jp-u-relations" }); append(list, el("h2", { text: "Relationships" })); for (const relation of relations) append(list, el("p", { text: `${pageObject(page, relation.from)?.name ?? relation.from} → ${relation.label ?? humanizeKey(relation.kind)} → ${pageObject(page, relation.to)?.name ?? relation.to}` })); append(root, list); } return root;
  };

  const inspector = (object: PageObject): HTMLElement => {
    const panel = el("aside", { className: "jp-u-inspector", attrs: { "aria-label": `${object.name} details` } }); const close = el("button", { className: "jp-u-close", text: "Close", attrs: { type: "button" } }); close.addEventListener("click", () => { state.selectedId = undefined; persist(); draw(); });
    append(panel, close, el("p", { className: "jp-u-type", text: humanizeKey(object.type) }), el("h2", { text: object.name })); if (object.summary) append(panel, el("p", { className: "jp-u-summary", text: object.summary }));
    const details = el("dl", { className: "jp-u-details" }); for (const field of object.fields ?? []) if (field.display !== "hidden") append(details, el("dt", { text: field.label ?? humanizeKey(field.key) }), el("dd", { text: formatValue(objectValue(object, field.key, state), field) })); append(panel, details); if (object.url) append(panel, externalLink(object.url, "Open source", "jp-u-button jp-u-primary"));
    const actions = (object.actionIds ?? []).map((id) => actionMap.get(id)).filter((action): action is PageAction => Boolean(action)); if (actions.length) { const controls = el("div", { className: "jp-u-actions" }); for (const action of actions) append(controls, actionControl(action, object)); append(panel, controls); } return panel;
  };

  function draw(): void {
    const root = el("div", { className: `jp-u-page jp-u-density-${page.view?.density ?? "comfortable"}` }); const header = el("header", { className: "jp-u-header" });
    const brand = el("div", { className: "jp-u-brandline" }); append(brand, el("span", { className: "jp-u-brand", text: "JUAN" }), el("span", { text: "Universal human surface" }));
    const utility = el("div", { className: "jp-u-utility" }); if (options.builderHref) append(utility, el("a", { className: "jp-u-button", text: "Build", attrs: { href: options.builderHref } }));
    const share = el("button", { className: "jp-u-button jp-u-primary", text: "Share", attrs: { type: "button" } }); share.addEventListener("click", () => { void (async () => { const url = options.onShare ? await options.onShare() : window.location.href; await navigator.clipboard.writeText(url); announce(header, "Share link copied"); })(); });
    const reset = el("button", { className: "jp-u-button", text: "Reset", attrs: { type: "button" } }); reset.addEventListener("click", () => { resetPageState(key); state.values = {}; state.lens = undefined; state.selectedId = undefined; state.activeGroup = undefined; draw(); }); append(utility, share, reset);
    append(header, brand, utility, el("h1", { text: page.title })); if (page.intent) append(header, el("p", { className: "jp-u-intent", text: page.intent })); if (page.description) append(header, el("p", { className: "jp-u-description", text: page.description }));
    if (page.metrics?.length) { const metrics = el("div", { className: "jp-u-metrics" }); for (const metric of page.metrics) { const item = el("div", { className: "jp-u-metric" }); append(item, el("strong", { text: metricValue(metric, page, state) }), el("span", { text: metric.label })); append(metrics, item); } append(header, metrics); }
    const controls = el("div", { className: "jp-u-controls" }); const search = el("input", { attrs: { type: "search", placeholder: "Search the world", value: query, "aria-label": "Search objects" } }) as HTMLInputElement; search.addEventListener("change", () => { query = search.value.trim().toLowerCase(); draw(); }); append(controls, search);
    const groupBy = page.view?.groupBy ?? "group"; if (groupBy !== "none") { const select = el("select", { attrs: { "aria-label": "Filter group" } }) as HTMLSelectElement; append(select, el("option", { text: "All groups", attrs: { value: "all" } })); const groups = [...new Set(page.objects.map((object) => groupBy === "type" ? object.type : groupBy === "status" ? object.status ?? "No status" : object.group ?? "Other"))]; for (const group of groups) append(select, el("option", { text: group, attrs: { value: group } })); select.value = state.activeGroup ?? "all"; select.addEventListener("change", () => { state.activeGroup = select.value; persist(); draw(); }); append(controls, select); }
    const lenses = el("div", { className: "jp-u-lenses", attrs: { role: "toolbar", "aria-label": "View" } }); const current = state.lens ?? page.view?.defaultLens ?? "cards"; for (const [lens, label] of [["cards", "Canvas"], ["table", "Data"], ["flow", "Flow"]] as const) { const button = el("button", { className: `jp-u-lens${current === lens ? " is-active" : ""}`, text: label, attrs: { type: "button", "aria-pressed": current === lens } }); button.addEventListener("click", () => setLens(lens)); append(lenses, button); } append(controls, lenses);
    const objects = visible(); const workspace = el("main", { className: "jp-u-workspace" }); if (!objects.length) append(workspace, el("p", { className: "jp-u-empty", text: "No objects match this view." })); else if (current === "table") append(workspace, tableLens(objects)); else if (current === "flow") append(workspace, flowLens(objects)); else append(workspace, cardsLens(objects)); append(root, header, controls, workspace);
    const selected = state.selectedId ? pageObject(page, state.selectedId) : undefined; if (selected) append(root, inspector(selected)); mount.replaceChildren(root);
  }
  draw(); return { root: mount.firstElementChild as HTMLElement, destroy: () => mount.replaceChildren() };
}
