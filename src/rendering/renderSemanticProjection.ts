import {
  formatSemanticValue,
  isSemanticValue,
  type PageScalar,
  type SemanticProjection,
  type SemanticProjectionResult,
  type SemanticValue,
} from "../schema/page.js";
import type { PageInteractionDomain, PageInteractionValue } from "../schema/interaction.js";
import type { PageState } from "../state/pageState.js";
import { append, el } from "./dom.js";

export type SemanticProjectionRenderContext = Readonly<{
  state: PageState;
  isActive: (value: PageScalar) => boolean;
  onDatum: (value: PageScalar, host: HTMLElement) => void;
  setState: (
    domain: PageInteractionDomain,
    key: string,
    value: PageInteractionValue | undefined,
    label: string,
    focusAnchor?: string,
  ) => void;
}>;

function numberText(value: number, unit?: string): string {
  const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  return unit ? `${number} ${unit}` : number;
}

function valueText(value: unknown): string {
  if (isSemanticValue(value)) return formatSemanticValue(value);
  if (Array.isArray(value)) return value.map(valueText).join(" · ");
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function anchor(projectionId: string, kind: string, id: string): string {
  return `${projectionId}:${kind}:${id}`.replace(/[^A-Za-z0-9._:-]/g, "-");
}

function datumButton(
  projectionId: string,
  id: string,
  label: string,
  active: boolean,
  context: SemanticProjectionRenderContext,
  value: PageScalar = id,
): HTMLButtonElement {
  const focusAnchor = anchor(projectionId, "datum", id);
  const button = el("button", {
    className: `jp-u-semantic-datum${active ? " is-active" : ""}`,
    text: label,
    attrs: {
      type: "button",
      "data-datum-id": id,
      "data-focus-anchor": focusAnchor,
      "aria-pressed": active,
    },
  });
  button.addEventListener("click", () => context.onDatum(value, button));
  return button;
}

function orderedByState<T extends { objectId: string }>(items: readonly T[], order: readonly string[] | undefined): T[] {
  if (!order?.length) return [...items];
  const ranks = new Map(order.map((id, index) => [id, index]));
  return [...items].sort((left, right) =>
    (ranks.get(left.objectId) ?? Number.MAX_SAFE_INTEGER) - (ranks.get(right.objectId) ?? Number.MAX_SAFE_INTEGER),
  );
}

function moveOrder(
  projectionId: string,
  ids: readonly string[],
  objectId: string,
  direction: -1 | 1,
  context: SemanticProjectionRenderContext,
  focusAnchor: string,
): void {
  const order = [...ids];
  const index = order.indexOf(objectId);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= order.length) return;
  [order[index], order[next]] = [order[next]!, order[index]!];
  context.setState("ordering", projectionId, order, `Reorder ${projectionId}`, focusAnchor);
}

function renderCategorical(
  projection: Extract<SemanticProjection, { family: "categorical" }>,
  result: Extract<SemanticProjectionResult, { family: "categorical" }>,
  context: SemanticProjectionRenderContext,
): HTMLElement {
  const list = el("div", { className: "jp-u-projection-points" });
  const max = Math.max(1, ...result.buckets.map((bucket) => Math.abs(bucket.value)));
  for (const bucket of result.buckets) {
    const id = valueText(bucket.key);
    const content = el("span", { className: "jp-u-projection-point-content" });
    const track = el("span", { className: "jp-u-projection-track" });
    append(track, el("span", {
      className: "jp-u-projection-bar",
      attrs: { style: `width:${Math.max(2, Math.abs(bucket.value) / max * 100)}%` },
    }));
    append(
      content,
      el("span", { className: "jp-u-projection-label", text: bucket.label }),
      track,
      el("strong", { text: numberText(bucket.value, bucket.unit) }),
    );
    const button = datumButton(projection.id, id, "", context.isActive(bucket.key), context, bucket.key);
    button.replaceChildren(content);
    append(list, button);
  }
  if (!result.buckets.length) append(list, el("p", { className: "jp-u-empty", text: "No data in the current scope." }));
  return list;
}

function renderTemporal(
  projection: Extract<SemanticProjection, { family: "temporal" }>,
  result: Extract<SemanticProjectionResult, { family: "temporal" }>,
  context: SemanticProjectionRenderContext,
): HTMLElement {
  const root = el("div", { className: "jp-u-temporal" });
  const timestamps = result.events.flatMap((event) => [Date.parse(event.start), event.end ? Date.parse(event.end) : Date.parse(event.start)]).filter(Number.isFinite);
  if (timestamps.length) {
    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);
    const current = Math.min(max, Math.max(min, context.state.playheads[projection.id] ?? min));
    const controls = el("label", { className: "jp-u-projection-control" });
    const output = el("output", { text: new Date(current).toLocaleString() });
    const slider = el("input", {
      attrs: {
        type: "range",
        min,
        max: Math.max(min + 1, max),
        step: Math.max(1000, Math.round((max - min) / 500)),
        value: current,
        "aria-label": `${projection.label} playhead`,
        "data-focus-anchor": anchor(projection.id, "playhead", "slider"),
      },
    }) as HTMLInputElement;
    slider.addEventListener("input", () => { output.textContent = new Date(Number(slider.value)).toLocaleString(); });
    slider.addEventListener("change", () => context.setState(
      "playheads",
      projection.id,
      Number(slider.value),
      `Move ${projection.label} playhead`,
      anchor(projection.id, "playhead", "slider"),
    ));
    append(controls, el("span", { text: "Playhead" }), slider, output);
    append(root, controls);
  }

  const list = el("ol", { className: "jp-u-timeline" });
  for (const event of result.events) {
    const item = el("li", { className: "jp-u-timeline-event" });
    const main = datumButton(projection.id, event.objectId, event.label, context.isActive(event.objectId), context);
    const meta = [new Date(event.start).toLocaleString(), event.end ? `→ ${new Date(event.end).toLocaleString()}` : "", event.lane ?? "", event.value === undefined ? "" : numberText(event.value, event.unit)].filter(Boolean).join(" · ");
    append(item, main, el("span", { className: "jp-u-semantic-meta", text: meta }));
    const range = el("button", {
      className: "jp-u-mini-button",
      text: "Use range",
      attrs: {
        type: "button",
        "data-focus-anchor": anchor(projection.id, "range", event.objectId),
      },
    });
    range.addEventListener("click", () => context.setState(
      "ranges",
      projection.id,
      ["interval", event.start, event.end ?? event.start, true, true],
      `Set ${projection.label} range`,
      anchor(projection.id, "range", event.objectId),
    ));
    append(item, range);
    append(list, item);
  }
  append(root, list);
  return root;
}

function renderMatrix(
  projection: Extract<SemanticProjection, { family: "matrix" }>,
  result: Extract<SemanticProjectionResult, { family: "matrix" }>,
  context: SemanticProjectionRenderContext,
): HTMLElement {
  const wrap = el("div", { className: "jp-u-matrix-wrap" });
  const table = el("table", { className: "jp-u-matrix" });
  const head = el("thead");
  const headRow = el("tr");
  append(headRow, el("th", { text: "" }));
  for (const column of result.columns) append(headRow, el("th", { text: column, attrs: { scope: "col" } }));
  append(head, headRow);
  const body = el("tbody");
  for (const row of result.rows) {
    const tableRow = el("tr");
    append(tableRow, el("th", { text: row, attrs: { scope: "row" } }));
    for (const column of result.columns) {
      const cell = result.cells.find((candidate) => candidate.row === row && candidate.column === column);
      const td = el("td");
      if (cell) {
        const id = `${row}:${column}`;
        append(td, datumButton(
          projection.id,
          id,
          numberText(cell.value, cell.unit),
          context.isActive(id),
          context,
          id,
        ));
      } else append(td, el("span", { text: "—" }));
      append(tableRow, td);
    }
    append(body, tableRow);
  }
  append(table, head, body);
  append(wrap, table);
  return wrap;
}

function renderHierarchy(
  projection: Extract<SemanticProjection, { family: "hierarchy" }>,
  result: Extract<SemanticProjectionResult, { family: "hierarchy" }>,
  context: SemanticProjectionRenderContext,
): HTMLElement {
  const byParent = new Map<string | undefined, typeof result.nodes[number][]>();
  for (const node of result.nodes) byParent.set(node.parentId, [...(byParent.get(node.parentId) ?? []), node]);
  const expanded = new Set(context.state.expansions[projection.id] ?? result.roots);

  const branch = (parentId: string | undefined, depth: number): HTMLUListElement => {
    const list = el("ul", { className: "jp-u-tree", attrs: { role: depth === 0 ? "tree" : "group" } });
    for (const node of byParent.get(parentId) ?? []) {
      const children = byParent.get(node.objectId) ?? [];
      const isExpanded = expanded.has(node.objectId);
      const item = el("li", {
        className: "jp-u-tree-item",
        attrs: {
          role: "treeitem",
          "aria-level": depth + 1,
          "aria-expanded": children.length ? isExpanded : undefined,
        },
      });
      const row = el("div", { className: "jp-u-tree-row" });
      if (children.length) {
        const focusAnchor = anchor(projection.id, "expand", node.objectId);
        const toggle = el("button", {
          className: "jp-u-tree-toggle",
          text: isExpanded ? "−" : "+",
          attrs: { type: "button", "aria-label": `${isExpanded ? "Collapse" : "Expand"} ${node.label}`, "data-focus-anchor": focusAnchor },
        });
        toggle.addEventListener("click", () => {
          const next = new Set(expanded);
          if (isExpanded) next.delete(node.objectId); else next.add(node.objectId);
          context.setState("expansions", projection.id, [...next], `${isExpanded ? "Collapse" : "Expand"} ${node.label}`, focusAnchor);
        });
        append(row, toggle);
      } else append(row, el("span", { className: "jp-u-tree-spacer", text: "" }));
      append(row, datumButton(projection.id, node.objectId, node.label, context.isActive(node.objectId), context));
      append(item, row);
      if (children.length && isExpanded) append(item, branch(node.objectId, depth + 1));
      append(list, item);
    }
    return list;
  };
  return branch(undefined, 0);
}

function renderNetwork(
  projection: Extract<SemanticProjection, { family: "network" }>,
  result: Extract<SemanticProjectionResult, { family: "network" }>,
  context: SemanticProjectionRenderContext,
): HTMLElement {
  const root = el("div", { className: "jp-u-network" });
  const currentPath = context.state.paths[projection.id] ?? [];
  const pathText = currentPath.length ? currentPath.join(" → ") : "No traversal path";
  const head = el("div", { className: "jp-u-projection-toolbar" });
  append(head, el("span", { className: "jp-u-semantic-meta", text: pathText }));
  if (currentPath.length) {
    const reset = el("button", { className: "jp-u-mini-button", text: "Clear path", attrs: { type: "button" } });
    reset.addEventListener("click", () => context.setState("paths", projection.id, [], `Clear ${projection.label} path`));
    append(head, reset);
  }
  append(root, head);

  const nodes = el("div", { className: "jp-u-network-nodes" });
  for (const node of result.nodes) {
    const focusAnchor = anchor(projection.id, "node", node.objectId);
    const button = datumButton(projection.id, node.objectId, `${node.label} · ${node.type}`, context.isActive(node.objectId), context);
    button.setAttribute("data-focus-anchor", focusAnchor);
    button.addEventListener("click", () => {
      const last = currentPath.at(-1);
      const connected = last && result.edges.some((edge) =>
        (edge.from === last && edge.to === node.objectId)
        || (!result.directed && edge.to === last && edge.from === node.objectId),
      );
      const next = connected ? [...currentPath, node.objectId] : [node.objectId];
      context.setState("paths", projection.id, next, `Traverse to ${node.label}`, focusAnchor);
    });
    append(nodes, button);
  }
  append(root, nodes);

  const edges = el("ul", { className: "jp-u-network-edges" });
  for (const edge of result.edges) {
    const arrow = result.directed ? "→" : "↔";
    const weight = edge.weight === undefined ? "" : ` · ${numberText(edge.weight, edge.weightUnit)}`;
    append(edges, el("li", { text: `${edge.from} ${arrow} ${edge.to} · ${edge.label ?? edge.kind}${weight}` }));
  }
  append(root, edges);
  return root;
}

type Point = Readonly<{ x: number; y: number }>;

function geometryPoints(value: SemanticValue): Point[] {
  if (value[0] === "coordinate") return [{ x: value[2], y: value[3] }];
  if (value[0] === "bounds") return [
    { x: value[2], y: value[3] },
    { x: value[4], y: value[3] },
    { x: value[4], y: value[5] },
    { x: value[2], y: value[5] },
  ];
  if (value[0] === "path") {
    const dimensions = value[2];
    const coordinates = value.slice(3) as readonly number[];
    const points: Point[] = [];
    for (let index = 0; index < coordinates.length; index += dimensions) points.push({ x: coordinates[index]!, y: coordinates[index + 1]! });
    return points;
  }
  if (value[0] === "geometry") {
    const dimensions = value[3];
    const coordinates = value.slice(4) as readonly number[];
    const points: Point[] = [];
    for (let index = 0; index < coordinates.length; index += dimensions) points.push({ x: coordinates[index]!, y: coordinates[index + 1]! });
    return points;
  }
  return [];
}

function svgElement<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS("http://www.w3.org/2000/svg", tag);
}

function renderSpatial(
  projection: Extract<SemanticProjection, { family: "spatial" }>,
  result: Extract<SemanticProjectionResult, { family: "spatial" }>,
  context: SemanticProjectionRenderContext,
): HTMLElement {
  const root = el("div", { className: "jp-u-spatial" });
  const viewport = context.state.viewports[projection.id] ?? { x: 0, y: 0, zoom: 1, rotation: 0 };
  const controls = el("div", { className: "jp-u-projection-toolbar" });
  const zoomAnchor = anchor(projection.id, "viewport", "zoom");
  const zoom = el("input", {
    attrs: { type: "range", min: .5, max: 8, step: .1, value: viewport.zoom, "aria-label": `${projection.label} zoom`, "data-focus-anchor": zoomAnchor },
  }) as HTMLInputElement;
  const zoomValue = el("output", { text: `${viewport.zoom.toFixed(1)}×` });
  zoom.addEventListener("input", () => { zoomValue.textContent = `${Number(zoom.value).toFixed(1)}×`; });
  zoom.addEventListener("change", () => context.setState("viewports", projection.id, { ...viewport, zoom: Number(zoom.value) }, `Zoom ${projection.label}`, zoomAnchor));
  append(controls, el("span", { text: "Zoom" }), zoom, zoomValue);
  for (const [label, dx, dy] of [["←", -10, 0], ["↑", 0, -10], ["↓", 0, 10], ["→", 10, 0]] as const) {
    const focusAnchor = anchor(projection.id, "viewport", label);
    const button = el("button", { className: "jp-u-mini-button", text: label, attrs: { type: "button", "aria-label": `Pan ${label}`, "data-focus-anchor": focusAnchor } });
    button.addEventListener("click", () => context.setState("viewports", projection.id, { ...viewport, x: viewport.x + dx, y: viewport.y + dy }, `Pan ${projection.label}`, focusAnchor));
    append(controls, button);
  }
  const reset = el("button", { className: "jp-u-mini-button", text: "Reset", attrs: { type: "button" } });
  reset.addEventListener("click", () => context.setState("viewports", projection.id, { x: 0, y: 0, zoom: 1, rotation: 0 }, `Reset ${projection.label} viewport`));
  append(controls, reset);
  append(root, controls);

  const allPoints = result.features.flatMap((feature) => geometryPoints(feature.geometry));
  if (allPoints.length) {
    const minX = Math.min(...allPoints.map((point) => point.x));
    const maxX = Math.max(...allPoints.map((point) => point.x));
    const minY = Math.min(...allPoints.map((point) => point.y));
    const maxY = Math.max(...allPoints.map((point) => point.y));
    const width = Math.max(1e-9, maxX - minX);
    const height = Math.max(1e-9, maxY - minY);
    const normalize = (point: Point): Point => ({ x: 5 + ((point.x - minX) / width) * 90, y: 95 - ((point.y - minY) / height) * 90 });
    const svg = svgElement("svg");
    svg.setAttribute("class", "jp-u-spatial-canvas");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `${projection.label} spatial overview`);
    const group = svgElement("g");
    group.setAttribute("transform", `translate(${viewport.x} ${viewport.y}) translate(50 50) scale(${viewport.zoom}) rotate(${viewport.rotation ?? 0}) translate(-50 -50)`);
    for (const feature of result.features) {
      const points = geometryPoints(feature.geometry).map(normalize);
      if (!points.length) continue;
      if (points.length === 1) {
        const circle = svgElement("circle");
        circle.setAttribute("cx", String(points[0]!.x));
        circle.setAttribute("cy", String(points[0]!.y));
        circle.setAttribute("r", "2.2");
        circle.setAttribute("class", "jp-u-spatial-feature");
        group.append(circle);
      } else {
        const shape = svgElement(feature.geometry[0] === "geometry" && feature.geometry[1] === "polygon" ? "polygon" : "polyline");
        shape.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
        shape.setAttribute("class", "jp-u-spatial-feature");
        group.append(shape);
      }
    }
    svg.append(group);
    append(root, svg);
  }

  const list = el("div", { className: "jp-u-spatial-list" });
  for (const feature of result.features) append(list, datumButton(projection.id, feature.objectId, feature.label, context.isActive(feature.objectId), context));
  append(root, list);
  return root;
}

function contentText(value: unknown): string {
  if (isSemanticValue(value) && value[0] === "content") return value[3] ?? value[4] ?? value[2] ?? "Empty content";
  return valueText(value);
}

function renderDocument(
  projection: Extract<SemanticProjection, { family: "document" }>,
  result: Extract<SemanticProjectionResult, { family: "document" }>,
  context: SemanticProjectionRenderContext,
): HTMLElement {
  const root = el("div", { className: "jp-u-document" });
  const natural = result.blocks.map((block) => block.objectId);
  const order = context.state.ordering[projection.id]?.length ? context.state.ordering[projection.id] : natural;
  const blocks = orderedByState(result.blocks, order);
  blocks.forEach((block, index) => {
    const article = el("article", { className: "jp-u-document-block", attrs: { "data-object-id": block.objectId } });
    const heading = el("div", { className: "jp-u-document-heading" });
    append(heading, datumButton(projection.id, block.objectId, block.label, context.isActive(block.objectId), context));
    const upAnchor = anchor(projection.id, "order-up", block.objectId);
    const up = el("button", { className: "jp-u-mini-button", text: "↑", attrs: { type: "button", disabled: index === 0, "aria-label": `Move ${block.label} up`, "data-focus-anchor": upAnchor } });
    up.addEventListener("click", () => moveOrder(projection.id, blocks.map((item) => item.objectId), block.objectId, -1, context, upAnchor));
    const downAnchor = anchor(projection.id, "order-down", block.objectId);
    const down = el("button", { className: "jp-u-mini-button", text: "↓", attrs: { type: "button", disabled: index === blocks.length - 1, "aria-label": `Move ${block.label} down`, "data-focus-anchor": downAnchor } });
    down.addEventListener("click", () => moveOrder(projection.id, blocks.map((item) => item.objectId), block.objectId, 1, context, downAnchor));
    append(heading, up, down);
    append(article, heading, el("pre", { className: "jp-u-document-content", text: contentText(block.content) }));
    if (block.range) {
      const rangeAnchor = anchor(projection.id, "range", block.objectId);
      const range = el("button", { className: "jp-u-mini-button", text: formatSemanticValue(block.range), attrs: { type: "button", "data-focus-anchor": rangeAnchor } });
      range.addEventListener("click", () => context.setState("ranges", projection.id, block.range, `Select ${block.label} range`, rangeAnchor));
      append(article, range);
    }
    append(root, article);
  });
  return root;
}

function renderStream(
  projection: Extract<SemanticProjection, { family: "stream" }>,
  result: Extract<SemanticProjectionResult, { family: "stream" }>,
  context: SemanticProjectionRenderContext,
): HTMLElement {
  const root = el("div", { className: "jp-u-stream" });
  const toolbar = el("label", { className: "jp-u-projection-control" });
  const grouping = context.state.groupings[projection.id] ?? "chronological";
  const select = el("select", { attrs: { "aria-label": `${projection.label} grouping`, "data-focus-anchor": anchor(projection.id, "group", "select") } }) as HTMLSelectElement;
  append(select, el("option", { text: "Chronological", attrs: { value: "chronological" } }), el("option", { text: "Thread", attrs: { value: "thread" } }));
  select.value = grouping;
  select.addEventListener("change", () => context.setState("groupings", projection.id, select.value, `Group ${projection.label}`, anchor(projection.id, "group", "select")));
  append(toolbar, el("span", { text: "Group" }), select);
  append(root, toolbar);

  const natural = result.events.map((event) => event.objectId);
  const order = context.state.ordering[projection.id]?.length ? context.state.ordering[projection.id] : natural;
  let events = orderedByState(result.events, order);
  if (grouping === "thread") events = [...events].sort((left, right) => (left.thread ?? "").localeCompare(right.thread ?? "") || left.timestamp.localeCompare(right.timestamp));
  const list = el("ol", { className: "jp-u-stream-list" });
  events.forEach((event, index) => {
    const item = el("li", { className: "jp-u-stream-event" });
    const head = el("div", { className: "jp-u-stream-head" });
    append(head, datumButton(projection.id, event.objectId, event.label, context.isActive(event.objectId), context));
    append(head, el("time", { text: new Date(event.timestamp).toLocaleString(), attrs: { datetime: event.timestamp } }));
    const upAnchor = anchor(projection.id, "stream-up", event.objectId);
    const up = el("button", { className: "jp-u-mini-button", text: "↑", attrs: { type: "button", disabled: index === 0, "aria-label": `Move ${event.label} earlier`, "data-focus-anchor": upAnchor } });
    up.addEventListener("click", () => moveOrder(projection.id, events.map((entry) => entry.objectId), event.objectId, -1, context, upAnchor));
    const downAnchor = anchor(projection.id, "stream-down", event.objectId);
    const down = el("button", { className: "jp-u-mini-button", text: "↓", attrs: { type: "button", disabled: index === events.length - 1, "aria-label": `Move ${event.label} later`, "data-focus-anchor": downAnchor } });
    down.addEventListener("click", () => moveOrder(projection.id, events.map((entry) => entry.objectId), event.objectId, 1, context, downAnchor));
    append(head, up, down);
    append(item, head);
    append(item, el("p", { className: "jp-u-semantic-meta", text: [event.author, event.thread].filter(Boolean).join(" · ") }));
    if (event.content !== undefined) append(item, el("pre", { className: "jp-u-stream-content", text: contentText(event.content) }));
    append(list, item);
  });
  append(root, list);
  return root;
}

export function renderSemanticProjection(
  projection: SemanticProjection,
  result: SemanticProjectionResult,
  context: SemanticProjectionRenderContext,
): HTMLElement {
  if (projection.family !== result.family) throw new Error(`Projection ${projection.id} result family mismatch`);
  if (projection.family === "categorical" && result.family === "categorical") return renderCategorical(projection, result, context);
  if (projection.family === "temporal" && result.family === "temporal") return renderTemporal(projection, result, context);
  if (projection.family === "matrix" && result.family === "matrix") return renderMatrix(projection, result, context);
  if (projection.family === "hierarchy" && result.family === "hierarchy") return renderHierarchy(projection, result, context);
  if (projection.family === "network" && result.family === "network") return renderNetwork(projection, result, context);
  if (projection.family === "spatial" && result.family === "spatial") return renderSpatial(projection, result, context);
  if (projection.family === "document" && result.family === "document") return renderDocument(projection, result, context);
  if (projection.family === "stream" && result.family === "stream") return renderStream(projection, result, context);
  throw new Error(`Unsupported semantic projection family ${projection.family}`);
}
