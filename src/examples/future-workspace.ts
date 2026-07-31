import type { JuanPageDocument } from "../schema/page.js";

export const futureWorkspace: JuanPageDocument = {
  version: "1.0",
  title: "The Human Interface for Agentic Work",
  intent: "Build the Future",
  description: "One schema describes the world. One runtime gives every human the right interface to understand it, change it, and hand it back to an agent.",
  theme: "dark",
  view: { defaultLens: "cards", groupBy: "group", density: "comfortable" },
  metrics: [
    { id: "objects", label: "Objects", operation: "count" },
    { id: "progress", label: "Execution progress", operation: "progress", field: "complete", format: "percent" },
    { id: "budget", label: "Runtime budget", operation: "sum", field: "credits", format: "number" }
  ],
  objects: [
    { id: "north-star", type: "vision", group: "Direction", name: "One schema. One UI.", status: "Active", tone: "success", summary: "Stop asking agents to design screens. Let them describe reality and let the runtime compose the human surface.", fields: [{ key: "principle", value: "Data is the interface specification", display: "prominent" }, { key: "complete", value: true }], actionIds: ["copy-object"] },
    { id: "schema", type: "capability", group: "System", name: "JuanPage object graph", status: "Ready", tone: "info", summary: "Arbitrary objects, ordered fields, relationships, actions, metrics, and view preferences in one strict document.", fields: [{ key: "version", value: "1.0" }, { key: "objectsSupported", value: "Any typed object" }, { key: "complete", value: true }] },
    { id: "runtime", type: "capability", group: "System", name: "Adaptive runtime", status: "Ready", tone: "info", summary: "The same objects become a canvas, a dense data surface, or a relationship flow without regenerating the source.", fields: [{ key: "lenses", value: ["Canvas", "Data", "Flow"] }, { key: "trustedDOM", value: true }, { key: "complete", value: true }] },
    { id: "decision", type: "decision", group: "Execution", name: "Choose the first execution path", status: "Needs human", tone: "warning", summary: "Human judgment is a field in the shared world, not a separate application flow.", fields: [{ key: "priority", value: "Universal demo" }, { key: "owner", value: "Human + agent" }, { key: "complete", value: false }], actionIds: ["choose-path", "approve-decision", "decision-note"] },
    { id: "task-schema", type: "task", group: "Execution", name: "Define the universal contract", status: "Done", tone: "success", summary: "Replace product-specific entities and component trees with general-purpose objects and relationships.", fields: [{ key: "owner", value: "Agent" }, { key: "effort", value: 3 }, { key: "complete", value: true }], actionIds: ["toggle-task"] },
    { id: "task-renderer", type: "task", group: "Execution", name: "Render every object through one workspace", status: "In progress", tone: "warning", summary: "Cards, tables, flows, inspectors, and controls all derive from the same source graph.", fields: [{ key: "owner", value: "Runtime" }, { key: "effort", value: 5 }, { key: "complete", value: false }], actionIds: ["toggle-renderer", "renderer-effort"] },
    { id: "credits", type: "resource", group: "Resources", name: "Runtime compute credits", status: "Available", tone: "neutral", summary: "Resources are just objects too. The renderer does not need a new component type.", fields: [{ key: "credits", value: 4200, format: "number", display: "prominent" }, { key: "unit", value: "agent-seconds" }, { key: "complete", value: false }] },
    { id: "risk", type: "risk", group: "Signals", name: "Interface fragmentation", status: "Eliminated", tone: "success", summary: "The system no longer accumulates one schema and one renderer for every use case.", fields: [{ key: "severity", value: "Previously high" }, { key: "mitigation", value: "Universal graph + adaptive lenses" }, { key: "complete", value: true }] }
  ],
  relations: [
    { from: "north-star", to: "schema", kind: "requires" },
    { from: "north-star", to: "runtime", kind: "requires" },
    { from: "schema", to: "task-schema", kind: "implemented-by" },
    { from: "runtime", to: "task-renderer", kind: "implemented-by" },
    { from: "decision", to: "task-renderer", kind: "unblocks" },
    { from: "credits", to: "runtime", kind: "powers" },
    { from: "runtime", to: "risk", kind: "eliminates" }
  ],
  actions: [
    { id: "copy-object", kind: "copy", label: "Copy vision", source: "object" },
    { id: "choose-path", kind: "choice", label: "Execution path", target: "decision", field: "priority", initial: "Universal demo", options: [{ label: "Universal demo", value: "Universal demo" }, { label: "Agent protocol", value: "Agent protocol" }, { label: "Remote documents", value: "Remote documents" }] },
    { id: "approve-decision", kind: "toggle", label: "Approve", target: "decision", field: "complete", initial: false, tone: "success" },
    { id: "decision-note", kind: "text", label: "Human context", target: "decision", field: "note", placeholder: "Tell the next agent what matters", multiline: true },
    { id: "toggle-task", kind: "toggle", label: "Complete", target: "task-schema", field: "complete", initial: true },
    { id: "toggle-renderer", kind: "toggle", label: "Complete", target: "task-renderer", field: "complete", initial: false },
    { id: "renderer-effort", kind: "number", label: "Effort", target: "task-renderer", field: "effort", initial: 5, min: 0, max: 20, step: 1 }
  ]
};
