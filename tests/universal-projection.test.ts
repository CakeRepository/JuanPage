import { describe, expect, it } from "vitest";
import { evaluateSemanticProjection, validateSemanticProjection } from "../src/projection/universal";
import type { PageObject, PageRelation } from "../src/schema/page";

const objects: PageObject[] = [
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
    group: "Delivery",
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
    group: "Delivery",
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

const relations: PageRelation[] = [
  { id: "r:owns:a", from: "org", to: "project:a", kind: "owns" },
  { id: "r:owns:b", from: "org", to: "project:b", kind: "owns" },
  { id: "r:depends", from: "project:b", to: "project:a", kind: "depends-on", label: "depends on" },
];

const source = { objects, relations };

describe("generalized semantic projection algebra", () => {
  it("evaluates categorical and matrix projections deterministically while preserving units", () => {
    const categorical = evaluateSemanticProjection(source, {
      id: "p:region",
      label: "Amount by region",
      family: "categorical",
      sourceType: "project",
      dimension: "region",
      measure: "amount",
      aggregate: "sum",
    });
    expect(categorical.family).toBe("categorical");
    if (categorical.family === "categorical") {
      expect(categorical.buckets.map((bucket) => bucket.value)).toEqual([100, 150]);
      expect(categorical.buckets.map((bucket) => bucket.unit)).toEqual(["USD", "USD"]);
    }

    const matrix = evaluateSemanticProjection(source, {
      id: "p:matrix",
      label: "Region by quarter",
      family: "matrix",
      sourceType: "project",
      row: "region",
      column: "quarter",
      measure: "amount",
      aggregate: "sum",
    });
    expect(matrix.family).toBe("matrix");
    if (matrix.family === "matrix") {
      expect(matrix.rows).toEqual(["North", "South"]);
      expect(matrix.columns).toEqual(["Q1", "Q2"]);
      expect(matrix.cells).toHaveLength(2);
      expect(matrix.cells.every((cell) => cell.unit === "USD")).toBe(true);
    }
  });

  it("evaluates temporal, hierarchy, and network meaning", () => {
    const temporal = evaluateSemanticProjection(source, {
      id: "p:time",
      label: "Project windows",
      family: "temporal",
      sourceType: "project",
      start: "window",
      measure: "amount",
    });
    expect(temporal.family).toBe("temporal");
    if (temporal.family === "temporal") {
      expect(temporal.events[0]?.start).toBe("2026-07-01T00:00:00.000Z");
      expect(temporal.events[0]?.end).toBe("2026-07-31T23:59:59.000Z");
      expect(temporal.events[0]?.unit).toBe("USD");
    }

    const hierarchy = evaluateSemanticProjection(source, {
      id: "p:tree",
      label: "Organization",
      family: "hierarchy",
      parentField: "parent",
      orderField: "order",
    });
    expect(hierarchy.family).toBe("hierarchy");
    if (hierarchy.family === "hierarchy") expect(hierarchy.roots).toEqual(["org"]);

    const network = evaluateSemanticProjection(source, {
      id: "p:network",
      label: "Dependencies",
      family: "network",
      relationKinds: ["depends-on"],
      weightField: "amount",
    });
    expect(network.family).toBe("network");
    if (network.family === "network") {
      expect(network.edges.map((edge) => edge.relationId)).toEqual(["r:depends"]);
      expect(network.edges[0]?.weightUnit).toBe("USD");
    }
  });

  it("evaluates spatial, document, and ordered stream meaning", () => {
    const spatial = evaluateSemanticProjection(source, {
      id: "p:map",
      label: "Project geometry",
      family: "spatial",
      geometryField: "geometry",
    });
    expect(spatial.family).toBe("spatial");
    if (spatial.family === "spatial") expect(spatial.features).toHaveLength(3);

    const document = evaluateSemanticProjection(source, {
      id: "p:document",
      label: "Plan",
      family: "document",
      sourceType: "project",
      contentField: "content",
      rangeField: "range",
      orderField: "order",
    });
    expect(document.family).toBe("document");
    if (document.family === "document") expect(document.blocks.map((block) => block.objectId)).toEqual(["project:a", "project:b"]);

    const stream = evaluateSemanticProjection(source, {
      id: "p:stream",
      label: "Project thread",
      family: "stream",
      sourceType: "project",
      timeField: "created",
      authorField: "author",
      threadField: "thread",
      contentField: "content",
    });
    expect(stream.family).toBe("stream");
    if (stream.family === "stream") expect(stream.events.map((event) => event.author)).toEqual(["Justin", "Agent"]);
  });

  it("rejects incomplete semantics, incompatible units, and hierarchy cycles", () => {
    expect(() => validateSemanticProjection({
      id: "p:bad",
      label: "Bad",
      family: "matrix",
      row: "region",
      column: "quarter",
      aggregate: "sum",
    })).toThrow();

    const mixedUnits: PageObject[] = [
      { id: "m:a", type: "measurement", name: "Mass", fields: [{ key: "kind", value: "total" }, { key: "value", value: ["quantity", 10, "kg"] }] },
      { id: "m:b", type: "measurement", name: "Length", fields: [{ key: "kind", value: "total" }, { key: "value", value: ["quantity", 5, "m"] }] },
    ];
    expect(() => evaluateSemanticProjection({ objects: mixedUnits }, {
      id: "p:units",
      label: "Invalid total",
      family: "categorical",
      dimension: "kind",
      measure: "value",
      aggregate: "sum",
    })).toThrow(/incompatible units/);

    const cyclic = objects.map((object) => object.id === "org"
      ? { ...object, fields: [...(object.fields ?? []).filter((field) => field.key !== "parent"), { key: "parent", value: "project:a" }] }
      : object);
    expect(() => evaluateSemanticProjection({ objects: cyclic, relations }, {
      id: "p:cycle",
      label: "Cycle",
      family: "hierarchy",
      parentField: "parent",
    })).toThrow(/cycle/);
  });
});
