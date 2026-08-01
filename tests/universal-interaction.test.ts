import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appendMeaningSessionDelta,
  createMeaningSession,
  decodePagePayload,
  encodeMeaningSession,
} from "../src/encoding/pagePipeline";
import {
  createInteractionStateDelta,
  createPageTransactionDelta,
  interactionStateFromPageDeltas,
} from "../src/protocol/interaction";
import { createActionReceipt, MeaningOpcode, type MeaningPacket } from "../src/protocol/meaning";
import { renderPage } from "../src/rendering/renderPage";
import { validatePage, type JuanPageDocument } from "../src/schema/page";
import {
  PageTransactionConflictError,
  commitPageTransaction,
  createPageTransaction,
  loadPageState,
  pageStateKey,
} from "../src/state/pageState";

const objects: JuanPageDocument["objects"] = [
  {
    id: "org",
    type: "organization",
    name: "Northstar",
    fields: [
      { key: "parent", value: null },
      { key: "order", value: 0 },
      { key: "geometry", value: ["coordinate", "EPSG:4326", -93.2, 44.8, null] },
    ],
  },
  {
    id: "project:a",
    type: "project",
    name: "Atlas",
    fields: [
      { key: "parent", value: "org" },
      { key: "order", value: 1 },
      { key: "region", value: "North" },
      { key: "quarter", value: "Q1" },
      { key: "amount", value: ["quantity", 100, "USD"] },
      { key: "window", value: ["interval", "2026-07-01T00:00:00.000Z", "2026-07-31T23:59:59.000Z", true, true] },
      { key: "geometry", value: ["geometry", "point", "EPSG:4326", 2, -93.1, 44.9] },
      { key: "content", value: ["content", "text/plain", null, "First block", "Block one", null] },
      { key: "range", value: ["content-range", "doc:plan", "line", 1, 3] },
      { key: "created", value: ["instant", "2026-07-10T12:00:00.000Z"] },
      { key: "author", value: "Justin" },
      { key: "thread", value: "thread:plan" },
    ],
  },
  {
    id: "project:b",
    type: "project",
    name: "Beacon",
    fields: [
      { key: "parent", value: "org" },
      { key: "order", value: 2 },
      { key: "region", value: "South" },
      { key: "quarter", value: "Q2" },
      { key: "amount", value: ["quantity", 150, "USD"] },
      { key: "window", value: ["interval", "2026-08-01T00:00:00.000Z", "2026-08-31T23:59:59.000Z", true, true] },
      { key: "geometry", value: ["path", "EPSG:4326", 2, -93.0, 44.7, -92.9, 44.8] },
      { key: "content", value: "Second block" },
      { key: "range", value: ["content-range", "doc:plan", "line", 4, 6] },
      { key: "created", value: "2026-07-11T12:00:00.000Z" },
      { key: "author", value: "Agent" },
      { key: "thread", value: "thread:plan" },
    ],
  },
];

const page = validatePage({
  version: "2.0",
  title: "Universal interaction runtime",
  objects,
  relations: [
    { id: "r:owns:a", from: "org", to: "project:a", kind: "owns" },
    { id: "r:owns:b", from: "org", to: "project:b", kind: "owns" },
    { id: "r:depends", from: "project:b", to: "project:a", kind: "depends-on", label: "depends on" },
  ],
  projections: [
    { id: "p:category", label: "Amount by region", family: "categorical", sourceType: "project", dimension: "region", measure: "amount", aggregate: "sum" },
    { id: "p:time", label: "Project windows", family: "temporal", sourceType: "project", start: "window", measure: "amount" },
    { id: "p:matrix", label: "Region by quarter", family: "matrix", sourceType: "project", row: "region", column: "quarter", measure: "amount", aggregate: "sum" },
    { id: "p:tree", label: "Organization", family: "hierarchy", parentField: "parent", orderField: "order" },
    { id: "p:network", label: "Dependencies", family: "network", relationKinds: ["depends-on"] },
    { id: "p:map", label: "Project geometry", family: "spatial", geometryField: "geometry" },
    { id: "p:document", label: "Plan", family: "document", sourceType: "project", contentField: "content", rangeField: "range", orderField: "order" },
    { id: "p:stream", label: "Project thread", family: "stream", sourceType: "project", timeField: "created", authorField: "author", threadField: "thread", contentField: "content" },
  ],
  affordances: [{ id: "select:projection", label: "Select", effect: { kind: "select", selection: "projection-items", mode: "multiple" }, input: { kind: "none" } }],
  bindings: [
    { id: "bind:tree", target: { kind: "projection", projection: "p:tree" }, affordance: "select:projection", priority: "primary" },
    { id: "bind:network", target: { kind: "projection", projection: "p:network" }, affordance: "select:projection", priority: "primary" },
  ],
  state: {
    selections: { "projection-items": [] },
    expansions: { "p:tree": ["org"] },
    viewports: { "p:map": { x: 0, y: 0, zoom: 1, rotation: 0 } },
    clocks: { simulation: { time: 10, rate: 2, paused: true, step: 1 } },
  },
});

function mount(): HTMLElement {
  const root = document.createElement("main");
  document.body.append(root);
  return root;
}

function buttonByText(root: ParentNode, text: string): HTMLButtonElement {
  const button = [...root.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === text);
  if (!button) throw new Error(`Missing button ${text}`);
  return button as HTMLButtonElement;
}

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("universal interaction runtime", () => {
  it("accepts one canonical page containing all semantic projection families and state domains", () => {
    expect(page.projections).toHaveLength(8);
    expect(page.state?.clocks?.simulation.time).toBe(10);
    expect(page.state?.viewports?.["p:map"].zoom).toBe(1);
  });

  it("adaptively renders every projection family and simulation state through renderPage", () => {
    const root = mount();
    renderPage(page, root);
    expect(root.querySelectorAll(".jp-u-projection")).toHaveLength(8);
    expect(root.querySelector(".jp-u-matrix")).toBeTruthy();
    expect(root.querySelector('[role="tree"]')).toBeTruthy();
    expect(root.querySelector(".jp-u-spatial-canvas")).toBeTruthy();
    expect(root.querySelectorAll(".jp-u-document-block")).toHaveLength(2);
    expect(root.querySelectorAll(".jp-u-stream-event")).toHaveLength(2);
    expect(root.querySelector('[data-clock-id="simulation"]')).toBeTruthy();
  });

  it("records hierarchy expansion and restores focus as one typed transaction", () => {
    const events: unknown[] = [];
    window.addEventListener("juanpager:interaction", (event) => events.push((event as CustomEvent).detail), { once: true });
    const root = mount();
    renderPage(page, root);
    const treeItem = root.querySelector('[data-projection-id="p:tree"] [role="treeitem"]') as HTMLElement;
    expect(treeItem.getAttribute("aria-expanded")).toBe("true");
    const toggle = root.querySelector('[data-projection-id="p:tree"] .jp-u-tree-toggle') as HTMLButtonElement;
    toggle.click();
    const updated = root.querySelector('[data-projection-id="p:tree"] [role="treeitem"]') as HTMLElement;
    expect(updated.getAttribute("aria-expanded")).toBe("false");
    expect(events[0]).toMatchObject({ kind: "transaction", action: "commit" });
    expect((events[0] as { patches: unknown[] }).patches).toHaveLength(2);
    expect(document.activeElement?.getAttribute("data-focus-anchor")).toContain("p:tree:expand:org");
  });

  it("supports viewport zoom with reversible undo and redo", () => {
    const actions: string[] = [];
    window.addEventListener("juanpager:interaction", (event) => {
      const detail = (event as CustomEvent<{ kind: string; action?: string }>).detail;
      if (detail.kind === "transaction" && detail.action) actions.push(detail.action);
    });
    const root = mount();
    renderPage(page, root);
    let zoom = root.querySelector('[data-projection-id="p:map"] input[type="range"]') as HTMLInputElement;
    zoom.value = "2";
    zoom.dispatchEvent(new Event("change", { bubbles: true }));
    zoom = root.querySelector('[data-projection-id="p:map"] input[type="range"]') as HTMLInputElement;
    expect(Number(zoom.value)).toBe(2);
    buttonByText(root, "Undo").click();
    zoom = root.querySelector('[data-projection-id="p:map"] input[type="range"]') as HTMLInputElement;
    expect(Number(zoom.value)).toBe(1);
    buttonByText(root, "Redo").click();
    zoom = root.querySelector('[data-projection-id="p:map"] input[type="range"]') as HTMLInputElement;
    expect(Number(zoom.value)).toBe(2);
    expect(actions).toEqual(["commit", "undo", "redo"]);
  });

  it("steps a simulation clock and reverses the step", () => {
    const root = mount();
    renderPage(page, root);
    const clock = () => root.querySelector('[data-clock-id="simulation"] .jp-u-clock-time')?.textContent;
    expect(clock()).toBe("10");
    const clockRoot = root.querySelector('[data-clock-id="simulation"]')!;
    buttonByText(clockRoot, "Step").click();
    expect(clock()).toBe("12");
    buttonByText(root, "Undo").click();
    expect(clock()).toBe("10");
  });

  it("fails closed when a prepared transaction precondition no longer matches", () => {
    const state = loadPageState(pageStateKey(page), page);
    const transaction = createPageTransaction("Conflicting zoom", [{
      domain: "interaction",
      state: "viewports",
      key: "p:map",
      before: { x: 10, y: 0, zoom: 1 },
      after: { x: 0, y: 0, zoom: 3 },
    }]);
    expect(() => commitPageTransaction(state, transaction)).toThrow(PageTransactionConflictError);
    expect(state.viewports["p:map"].zoom).toBe(1);
  });

  it("encodes state and reversible transactions in ordinary M1 action deltas", async () => {
    const packet: MeaningPacket = [
      1,
      "pkt:interaction",
      0,
      null,
      [],
      [
        [MeaningOpcode.Header, [1, "Interaction"], null, null, 0],
        [MeaningOpcode.Entity, "e:item", "type:item", [1, "Item"], null, null, 0, null, [], []],
      ],
    ];
    const stateDelta = createInteractionStateDelta("pkt:interaction", 0, "viewports", "p:map", { x: 0, y: 0, zoom: 2 });
    const receipt = createActionReceipt(stateDelta, "succeeded", { execution: "local-state" });
    const transactionDelta = createPageTransactionDelta("pkt:interaction", 1, "tx:zoom", "undo", [{
      domain: "interaction",
      state: "viewports",
      key: "p:map",
      before: { x: 0, y: 0, zoom: 1 },
      after: { x: 0, y: 0, zoom: 2 },
    }]);
    const reconstructed = interactionStateFromPageDeltas([stateDelta, transactionDelta]);
    expect(reconstructed.viewports?.["p:map"].zoom).toBe(1);

    let session = createMeaningSession(packet);
    session = appendMeaningSessionDelta(session, stateDelta, receipt);
    session = appendMeaningSessionDelta(session, transactionDelta);
    const decoded = await decodePagePayload(await encodeMeaningSession(session, "raw"), "raw");
    expect(decoded.kind).toBe("m1-session");
    if (decoded.kind === "m1-session") expect(decoded.page.state?.viewports?.["p:map"].zoom).toBe(1);
  });
});
