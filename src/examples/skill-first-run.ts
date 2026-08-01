import type { JuanPageDocument } from "../schema/page.js";

export const skillFirstRunPage: JuanPageDocument = {
  version: "2.0",
  title: "AI Product Launch Command Center",
  description: "A complete first-run JuanPage generated from a user request. The runtime chooses the human presentation while every control updates typed semantic state.",
  intent: "Give one human a truthful, interactive view of launch readiness",
  theme: "system",
  objects: [
    {
      id: "launch:atlas",
      type: "Launch",
      name: "Project Atlas",
      summary: "Ship the public beta with a clear owner, launch date, workstream readiness, and one source of truth.",
      group: "Launch brief",
      status: "In progress",
      tone: "info",
      fields: [
        { key: "status", label: "Launch status", value: "In progress", display: "prominent" },
        { key: "owner", label: "Launch owner", value: "Maya Chen" },
        { key: "launchDate", label: "Launch date", value: "2026-08-14", format: "date" },
        { key: "summary", label: "Launch brief", value: "Public beta for the agent-native operations workspace." },
      ],
    },
    {
      id: "task:product",
      type: "Launch task",
      name: "Product readiness",
      summary: "Complete release candidate validation and publish the rollback plan.",
      group: "Workstreams",
      status: "Ready",
      tone: "success",
      fields: [
        { key: "workstream", label: "Workstream", value: "Product" },
        { key: "owner", label: "Owner", value: "Ari" },
        { key: "done", label: "Complete", value: true },
      ],
    },
    {
      id: "task:marketing",
      type: "Launch task",
      name: "Launch story",
      summary: "Finalize the announcement, product screenshots, and customer proof.",
      group: "Workstreams",
      status: "In progress",
      tone: "info",
      fields: [
        { key: "workstream", label: "Workstream", value: "Marketing" },
        { key: "owner", label: "Owner", value: "Nora" },
        { key: "done", label: "Complete", value: false },
      ],
    },
    {
      id: "task:sales",
      type: "Launch task",
      name: "Sales enablement",
      summary: "Deliver the demo path, objection guide, and qualified launch list.",
      group: "Workstreams",
      status: "In progress",
      tone: "info",
      fields: [
        { key: "workstream", label: "Workstream", value: "Sales" },
        { key: "owner", label: "Owner", value: "Luis" },
        { key: "done", label: "Complete", value: false },
      ],
    },
    {
      id: "task:support",
      type: "Launch task",
      name: "Support coverage",
      summary: "Publish escalation ownership and the first-week support schedule.",
      group: "Workstreams",
      status: "Blocked",
      tone: "warning",
      fields: [
        { key: "workstream", label: "Workstream", value: "Support" },
        { key: "owner", label: "Owner", value: "Sam" },
        { key: "done", label: "Complete", value: false },
      ],
    },
  ],
  metrics: [
    { id: "metric:readiness", label: "Launch readiness", operation: "progress", field: "done", format: "percent" },
    { id: "metric:tasks", label: "Launch tasks", operation: "count" },
  ],
  scopes: [
    {
      id: "scope:workstream",
      label: "Focus workstream",
      field: "workstream",
      initial: null,
      objectTypes: ["Launch task"],
    },
  ],
  projections: [
    {
      id: "projection:workstreams",
      label: "Tasks by workstream",
      sourceType: "Launch task",
      dimension: "workstream",
      operation: "count",
      order: "asc",
    },
  ],
  affordances: [
    {
      id: "affordance:scope-workstream",
      label: "Focus workstream",
      effect: { kind: "scope", scope: "scope:workstream" },
      input: {
        kind: "choice",
        options: [
          { label: "All workstreams", value: null },
          { label: "Product", value: "Product" },
          { label: "Marketing", value: "Marketing" },
          { label: "Sales", value: "Sales" },
          { label: "Support", value: "Support" },
        ],
      },
    },
    {
      id: "affordance:set-launch-status",
      label: "Set launch status",
      effect: { kind: "set", field: "status" },
      input: {
        kind: "choice",
        options: [
          { label: "Planning", value: "Planning" },
          { label: "In progress", value: "In progress" },
          { label: "Ready", value: "Ready" },
          { label: "Blocked", value: "Blocked" },
        ],
      },
    },
    {
      id: "affordance:toggle-task",
      label: "Mark complete",
      effect: { kind: "set", field: "done" },
      input: { kind: "boolean" },
    },
    {
      id: "affordance:inspect-task",
      label: "Inspect task",
      effect: { kind: "inspect" },
      input: { kind: "none" },
    },
    {
      id: "affordance:copy-brief",
      label: "Copy launch brief",
      effect: { kind: "copy", source: "field", field: "summary" },
      input: { kind: "none" },
    },
  ],
  bindings: [
    {
      id: "binding:scope-page",
      target: { kind: "page" },
      affordance: "affordance:scope-workstream",
      priority: "primary",
    },
    {
      id: "binding:scope-projection",
      target: { kind: "projection", projection: "projection:workstreams" },
      affordance: "affordance:scope-workstream",
      priority: "primary",
    },
    {
      id: "binding:launch-status",
      target: { kind: "field", object: "launch:atlas", field: "status" },
      affordance: "affordance:set-launch-status",
      priority: "primary",
    },
    {
      id: "binding:copy-brief",
      target: { kind: "field", object: "launch:atlas", field: "summary" },
      affordance: "affordance:copy-brief",
      priority: "secondary",
    },
    ...["task:product", "task:marketing", "task:sales", "task:support"].flatMap((object) => [
      {
        id: `binding:${object}:done`,
        target: { kind: "field" as const, object, field: "done" },
        affordance: "affordance:toggle-task",
        priority: "primary" as const,
      },
      {
        id: `binding:${object}:inspect`,
        target: { kind: "object" as const, object },
        affordance: "affordance:inspect-task",
        priority: "secondary" as const,
      },
    ]),
  ],
  metadata: {
    "example.kind": "skill-first-run",
    "example.host": "https://cakerepository.github.io/juanpager/",
  },
};
