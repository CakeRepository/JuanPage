import { readFile, writeFile } from "node:fs/promises";

async function edit(path, transform) {
  const source = await readFile(path, "utf8");
  const next = transform(source);
  if (next === source) throw new Error(`No changes produced for ${path}`);
  await writeFile(path, next);
}

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing migration anchor: ${label}`);
  return source.replace(before, after);
}

await edit("src/schema/interaction.ts", (source) => {
  source = replaceOnce(
    source,
    `  "groupings",\n  "focus",\n  "clocks",`,
    `  "groupings",\n  "queries",\n  "filters",\n  "panels",\n  "focus",\n  "clocks",`,
    "interaction domains",
  );
  source = replaceOnce(
    source,
    `  groupings: z.record(id).optional(),\n  focus: id.optional(),\n  clocks: z.record(pageClockStateSchema).optional(),`,
    `  groupings: z.record(id).optional(),\n  queries: z.record(z.string().max(500)).optional(),\n  filters: z.record(pageScalarSchema).optional(),\n  panels: z.record(z.string().max(1000)).optional(),\n  focus: id.optional(),\n  clocks: z.record(pageClockStateSchema).optional(),`,
    "interaction state fields",
  );
  return source;
});

await edit("src/state/pageState.ts", (source) => {
  source = replaceOnce(
    source,
    `  groupings: Record<string, string>;\n  focus?: string;\n  clocks: Record<string, PageClockState>;\n  history: PageTransaction[];\n  future: PageTransaction[];\n  inspection?: PageBindingTarget;\n  activeGroup?: string;`,
    `  groupings: Record<string, string>;\n  queries: Record<string, string>;\n  filters: Record<string, PageScalar>;\n  panels: Record<string, string>;\n  focus?: string;\n  clocks: Record<string, PageClockState>;\n  history: PageTransaction[];\n  future: PageTransaction[];`,
    "PageState fields",
  );
  source = source.replace("  type PageBindingTarget,\n", "");
  source = replaceOnce(
    source,
    `    groupings: { ...(page.state?.groupings ?? {}) },\n    focus: page.state?.focus,\n    clocks: structuredClone(page.state?.clocks ?? {}),`,
    `    groupings: { ...(page.state?.groupings ?? {}) },\n    queries: { ...(page.state?.queries ?? {}) },\n    filters: { ...(page.state?.filters ?? {}) },\n    panels: { ...(page.state?.panels ?? {}) },\n    focus: page.state?.focus,\n    clocks: structuredClone(page.state?.clocks ?? {}),`,
    "initial semantic state",
  );
  source = replaceOnce(
    source,
    `    groupings: state.groupings,\n    focus: state.focus,\n    clocks: state.clocks,`,
    `    groupings: state.groupings,\n    queries: state.queries,\n    filters: state.filters,\n    panels: state.panels,\n    focus: state.focus,\n    clocks: state.clocks,`,
    "persisted interaction snapshot",
  );
  source = replaceOnce(
    source,
    `      groupings: { ...fallback.groupings, ...(restored.groupings ?? {}) },\n      focus: restored.focus ?? fallback.focus,\n      clocks: structuredClone(restored.clocks ?? fallback.clocks),\n      history: validTransactions(parsed.history),\n      future: validTransactions(parsed.future),\n      inspection: parsed.inspection && typeof parsed.inspection === "object" ? parsed.inspection : undefined,\n      activeGroup: typeof parsed.activeGroup === "string" ? parsed.activeGroup : undefined,`,
    `      groupings: { ...fallback.groupings, ...(restored.groupings ?? {}) },\n      queries: { ...fallback.queries, ...(restored.queries ?? {}) },\n      filters: { ...fallback.filters, ...(restored.filters ?? {}) },\n      panels: { ...fallback.panels, ...(restored.panels ?? {}) },\n      focus: restored.focus ?? fallback.focus,\n      clocks: structuredClone(restored.clocks ?? fallback.clocks),\n      history: validTransactions(parsed.history),\n      future: validTransactions(parsed.future),`,
    "restored semantic state",
  );
  source = replaceOnce(
    source,
    `export function pageInteractionSnapshot(state: PageState): import("../schema/interaction.js").PageInteractionState {`,
    `export function resetPageToInitial(\n  state: PageState,\n  page: JuanPageDocument,\n  label = "Reset page",\n): PageTransaction | undefined {\n  const target = initialState(page);\n  const patches: PageStatePatch[] = [];\n\n  for (const [objectId, fields] of Object.entries(state.values)) {\n    for (const [field, before] of Object.entries(fields)) {\n      patches.push({ domain: "value", target: objectId, field, before, after: undefined });\n    }\n  }\n\n  for (const key of new Set([...Object.keys(state.scopes), ...Object.keys(target.scopes)])) {\n    const before = state.scopes[key];\n    const after = target.scopes[key];\n    if (!equal(before, after)) patches.push({ domain: "scope", key, before, after });\n  }\n\n  for (const key of new Set([...Object.keys(state.selections), ...Object.keys(target.selections)])) {\n    const before = state.selections[key] === undefined ? undefined : [...state.selections[key]];\n    const after = target.selections[key] === undefined ? undefined : [...target.selections[key]];\n    if (!equal(before, after)) patches.push({ domain: "selection", key, before, after });\n  }\n\n  const domains: Exclude<PageInteractionDomain, "focus">[] = [\n    "expansions",\n    "paths",\n    "viewports",\n    "ranges",\n    "playheads",\n    "ordering",\n    "groupings",\n    "queries",\n    "filters",\n    "panels",\n    "clocks",\n  ];\n  for (const domain of domains) {\n    const currentRecord = interactionRecord(state, domain);\n    const targetRecord = interactionRecord(target, domain);\n    for (const key of new Set([...Object.keys(currentRecord), ...Object.keys(targetRecord)])) {\n      const before = interactionValue(state, domain, key);\n      const after = interactionValue(target, domain, key);\n      if (!equal(before, after)) patches.push({ domain: "interaction", state: domain, key, before, after });\n    }\n  }\n  if (!equal(state.focus, target.focus)) {\n    patches.push({ domain: "interaction", state: "focus", key: "active", before: state.focus, after: target.focus });\n  }\n  if (!patches.length) return undefined;\n  return commitPageTransaction(state, createPageTransaction(label, patches));\n}\n\nexport function pageInteractionSnapshot(state: PageState): import("../schema/interaction.js").PageInteractionState {`,
    "reset transaction",
  );
  source = replaceOnce(
    source,
    `    groupings: { ...state.groupings },\n    focus: state.focus,\n    clocks: structuredClone(state.clocks),`,
    `    groupings: { ...state.groupings },\n    queries: { ...state.queries },\n    filters: { ...state.filters },\n    panels: { ...state.panels },\n    focus: state.focus,\n    clocks: structuredClone(state.clocks),`,
    "shared interaction snapshot",
  );
  return source;
});

await edit("src/rendering/renderPage.ts", (source) => {
  source = replaceOnce(
    source,
    `  pageObject,\n  type JuanPageDocument,`,
    `  pageBindingTargetSchema,\n  pageObject,\n  type JuanPageDocument,`,
    "binding target validator import",
  );
  source = source.replace("  resetPageState,\n", "  resetPageToInitial,\n");
  source = replaceOnce(
    source,
    `function targetKey(target: PageBindingTarget): string {\n  if (target.kind === "page") return "page";\n  if (target.kind === "object") return \`object:\${target.object}\`;\n  if (target.kind === "field") return \`field:\${target.object}:\${target.field}\`;\n  if (target.kind === "metric") return \`metric:\${target.metric}\`;\n  if (target.kind === "relation") return \`relation:\${target.relation}\`;\n  return \`projection:\${target.projection}\`;\n}\n`,
    `function targetKey(target: PageBindingTarget): string {\n  if (target.kind === "page") return "page";\n  if (target.kind === "object") return \`object:\${target.object}\`;\n  if (target.kind === "field") return \`field:\${target.object}:\${target.field}\`;\n  if (target.kind === "metric") return \`metric:\${target.metric}\`;\n  if (target.kind === "relation") return \`relation:\${target.relation}\`;\n  return \`projection:\${target.projection}\`;\n}\n\nfunction serializeTarget(target: PageBindingTarget): string {\n  return JSON.stringify(target);\n}\n\nfunction parseTarget(value: string | undefined): PageBindingTarget | undefined {\n  if (!value) return undefined;\n  try {\n    const result = pageBindingTargetSchema.safeParse(JSON.parse(value));\n    return result.success ? result.data : undefined;\n  } catch {\n    return undefined;\n  }\n}\n`,
    "binding target serialization",
  );
  source = replaceOnce(
    source,
    `function copyState(target: PageState, source: PageState): void {\n  target.values = source.values;\n  target.scopes = source.scopes;\n  target.selections = source.selections;\n  target.expansions = source.expansions;\n  target.paths = source.paths;\n  target.viewports = source.viewports;\n  target.ranges = source.ranges;\n  target.playheads = source.playheads;\n  target.ordering = source.ordering;\n  target.groupings = source.groupings;\n  target.focus = source.focus;\n  target.clocks = source.clocks;\n  target.history = source.history;\n  target.future = source.future;\n  target.inspection = source.inspection;\n  target.activeGroup = source.activeGroup;\n}\n\n`,
    ``,
    "retired ad hoc state copy",
  );
  source = source.replace("  let query = \"\";\n", "");
  source = replaceOnce(
    source,
    `    if (effect.kind === "inspect") {\n      state.inspection = binding.target;\n      persist();\n      draw();\n      await notify(affordance, binding, value);\n      return;\n    }`,
    `    if (effect.kind === "inspect") {\n      setPageInteractionState(state, "panels", "inspector", serializeTarget(binding.target), affordance.label);\n      persist();\n      draw();\n      await notify(affordance, binding, value);\n      return;\n    }`,
    "typed inspection state",
  );
  source = replaceOnce(
    source,
    `  const visibleObjects = (): PageObject[] => scopedObjects(page, state).filter((object) => {\n    const groupVisible = !state.activeGroup || state.activeGroup === "all" || (object.group ?? "Other") === state.activeGroup;\n    return groupVisible && (!query || objectText(object, state).includes(query));\n  });`,
    `  const visibleObjects = (): PageObject[] => scopedObjects(page, state).filter((object) => {\n    const activeGroup = typeof state.filters.group === "string" ? state.filters.group : undefined;\n    const query = state.queries.objects?.trim().toLowerCase() ?? "";\n    const groupVisible = !activeGroup || activeGroup === "all" || (object.group ?? "Other") === activeGroup;\n    return groupVisible && (!query || objectText(object, state).includes(query));\n  });`,
    "typed search and group filter",
  );
  source = replaceOnce(
    source,
    `    close.addEventListener("click", () => { state.inspection = undefined; persist(); draw(); });`,
    `    close.addEventListener("click", () => {\n      setPageInteractionState(state, "panels", "inspector", undefined, "Close inspector");\n      persist();\n      draw();\n    });`,
    "typed inspector close",
  );
  source = replaceOnce(
    source,
    `      const toggleAnchor = \`clock:\${clockId}:toggle\`;\n      const toggle = el("button", { className: "jp-u-button", text: clock.paused ? "Run" : "Pause", attrs: { type: "button", "data-focus-anchor": toggleAnchor } });\n      toggle.addEventListener("click", () => {\n        setPageInteractionState(state, "clocks", clockId, { ...clock, paused: !clock.paused }, \`\${clock.paused ? "Run" : "Pause"} \${clockId}\`, toggleAnchor);\n        persist(); draw();\n      });\n      const stepAnchor = \`clock:\${clockId}:step\`;`,
    `      const mode = el("span", { className: "jp-u-clock-mode", text: clock.paused ? "Paused" : "Externally driven" });\n      const stepAnchor = \`clock:\${clockId}:step\`;`,
    "truthful clock controls",
  );
  source = source.replace(
    `      append(row, el("strong", { text: humanizeKey(clockId) }), time, toggle, step, rate);`,
    `      append(row, el("strong", { text: humanizeKey(clockId) }), time, mode, step, rate);`,
  );
  source = replaceOnce(
    source,
    `    const share = el("button", { className: "jp-u-button jp-u-primary", text: "Share", attrs: { type: "button" } });\n    share.addEventListener("click", () => { void (async () => { const url = options.onShare ? await options.onShare() : window.location.href; await navigator.clipboard.writeText(url); announce(header, "Share link copied"); })(); });\n    const reset = el("button", { className: "jp-u-button is-quiet", text: "Reset", attrs: { type: "button" } });\n    reset.addEventListener("click", () => { resetPageState(storageKey); copyState(state, loadPageState(storageKey, page)); query = ""; draw(); });`,
    `    const runtimeStatus = el("p", { className: "jp-u-runtime-status", attrs: { role: "status", "aria-live": "polite" } });\n    const share = el("button", { className: "jp-u-button jp-u-primary", text: "Share", attrs: { type: "button" } });\n    share.addEventListener("click", () => {\n      void (async () => {\n        try {\n          const url = options.onShare ? await options.onShare() : window.location.href;\n          await navigator.clipboard.writeText(url);\n          runtimeStatus.textContent = "Share link copied. It contains the current human state.";\n          runtimeStatus.className = "jp-u-runtime-status is-success";\n          announce(header, "Share link copied");\n        } catch (error) {\n          runtimeStatus.textContent = `Share failed: \${error instanceof Error ? error.message : String(error)}`;\n          runtimeStatus.className = "jp-u-runtime-status is-error";\n          announce(header, "Share failed");\n        }\n      })();\n    });\n    const reset = el("button", { className: "jp-u-button is-quiet", text: "Reset", attrs: { type: "button" } });\n    reset.addEventListener("click", () => {\n      const transaction = resetPageToInitial(state, page);\n      persist();\n      draw();\n      if (transaction) announce(header, `Reset \${transaction.patches.length} state change\${transaction.patches.length === 1 ? "" : "s"}`);\n    });`,
    "truthful share and reset",
  );
  source = replaceOnce(
    source,
    `    if (page.description) append(header, el("p", { className: "jp-u-description", text: page.description }));\n    if (page.metrics?.length) {`,
    `    if (page.description) append(header, el("p", { className: "jp-u-description", text: page.description }));\n    append(header, runtimeStatus);\n    if (page.metrics?.length) {`,
    "visible runtime status",
  );
  source = replaceOnce(
    source,
    `    if (page.objects.length > 6) {\n      const search = el("input", { attrs: { type: "search", placeholder: "Search", value: query, "aria-label": "Search objects" } }) as HTMLInputElement;\n      search.addEventListener("input", () => { query = search.value.trim().toLowerCase(); draw(); });\n      append(controls, search);\n    }`,
    `    if (page.objects.length > 6) {\n      const searchAnchor = "query:objects";\n      const search = el("input", { attrs: {\n        type: "search",\n        placeholder: "Search",\n        value: state.queries.objects ?? "",\n        "aria-label": "Search objects",\n        "data-focus-anchor": searchAnchor,\n      } }) as HTMLInputElement;\n      search.addEventListener("input", () => {\n        setPageInteractionState(state, "queries", "objects", search.value || undefined, "Search objects", searchAnchor);\n        persist();\n        draw();\n      });\n      append(controls, search);\n    }`,
    "typed search control",
  );
  source = replaceOnce(
    source,
    `      select.value = state.activeGroup ?? "all";\n      select.addEventListener("change", () => { state.activeGroup = select.value; persist(); draw(); });`,
    `      const groupAnchor = "filter:group";\n      select.setAttribute("data-focus-anchor", groupAnchor);\n      select.value = typeof state.filters.group === "string" ? state.filters.group : "all";\n      select.addEventListener("change", () => {\n        setPageInteractionState(state, "filters", "group", select.value === "all" ? undefined : select.value, "Filter group", groupAnchor);\n        persist();\n        draw();\n      });`,
    "typed group filter",
  );
  source = replaceOnce(
    source,
    `    if (state.inspection) append(root, inspector(state.inspection));`,
    `    const activeInspection = parseTarget(state.panels.inspector);\n    if (activeInspection) append(root, inspector(activeInspection));`,
    "shared inspector state",
  );
  return source;
});

await edit("scripts/enforce-one-runtime.ts", (source) => replaceOnce(
  source,
  `for (const domain of ["expansions", "paths", "viewports", "ranges", "playheads", "ordering", "groupings", "focus", "clocks"] as const)`,
  `for (const domain of ["expansions", "paths", "viewports", "ranges", "playheads", "ordering", "groupings", "queries", "filters", "panels", "focus", "clocks"] as const)`,
  "one-runtime interaction domains",
));

await edit("src/universal.css", (source) => {
  if (source.includes(".jp-u-runtime-status")) throw new Error("Runtime status styles already exist");
  return `${source}\n\n.jp-u-runtime-status {\n  min-height: 1.25rem;\n  margin: .5rem 0 0;\n  font-size: .875rem;\n  color: var(--jp-muted);\n}\n\n.jp-u-runtime-status.is-success { color: var(--jp-success, #42d392); }\n.jp-u-runtime-status.is-error { color: var(--jp-danger, #ff6b7a); }\n.jp-u-clock-mode { color: var(--jp-muted); font-size: .875rem; }\n`;
});

console.log("Universal human runtime migration applied.");
