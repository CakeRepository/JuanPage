import { announce, append, el, externalLink, imageWithFallback } from "./dom.js";
import { applyTheme, type RenderHandle } from "./render.js";
import {
  humanizeKey,
  objectField,
  pageAffordance,
  pageObject,
  type JuanPageDocument,
  type PageAffordance,
  type PageBinding,
  type PageBindingTarget,
  type PageField,
  type PageMetric,
  type PageObject,
  type PageProjection,
  type PageScalar,
} from "../schema/page.js";
import {
  effectiveFieldValue,
  loadPageState,
  pageStateKey,
  resetPageState,
  savePageState,
  setPageScope,
  setPageSelection,
  setPageValue,
  type PageState,
} from "../state/pageState.js";

export type PageAffordanceInvocation = Readonly<{
  affordanceId: string;
  effect: PageAffordance["effect"]["kind"];
  target: PageBindingTarget;
  objectId?: string;
  value?: PageScalar;
  operation?: string;
  values: Readonly<Record<string, Readonly<Record<string, PageScalar>>>>;
  scopes: Readonly<Record<string, PageScalar>>;
  selections: Readonly<Record<string, readonly string[]>>;
}>;

export type UniversalRenderOptions = {
  builderHref?: string;
  onShare?: () => string | Promise<string>;
  onAffordance?: (invocation: PageAffordanceInvocation) => void | Promise<void>;
};

type ProjectionPoint = Readonly<{ id: string; key: PageScalar; label: string; value: number }>;

function scalarText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.map(scalarText).join(" · ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatNumber(value: number, format?: "auto" | "number" | "currency" | "percent", currency = "USD"): string {
  if (format === "currency") return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  if (format === "percent") return `${Math.round(value * 100)}%`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatValue(value: unknown, field?: PageField): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.map(scalarText).join(" · ");
  if (typeof value === "number") {
    return formatNumber(value, field?.format === "currency" || field?.format === "percent" || field?.format === "number" ? field.format : "auto", field?.currency);
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

function targetKey(target: PageBindingTarget): string {
  if (target.kind === "page") return "page";
  if (target.kind === "object") return `object:${target.object}`;
  if (target.kind === "field") return `field:${target.object}:${target.field}`;
  if (target.kind === "metric") return `metric:${target.metric}`;
  if (target.kind === "relation") return `relation:${target.relation}`;
  return `projection:${target.projection}`;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return left === right || String(left) === String(right);
}

function objectMatchesScopes(
  object: PageObject,
  page: JuanPageDocument,
  state: PageState,
  ignoreScopes: readonly string[] = [],
): boolean {
  for (const scope of page.scopes ?? []) {
    if (ignoreScopes.includes(scope.id)) continue;
    const active = state.scopes[scope.id];
    if (active === undefined || active === null) continue;
    if (scope.objectTypes?.length && !scope.objectTypes.includes(object.type)) continue;
    const value = objectValue(object, scope.field, state);
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      if (!value.some((item) => valuesEqual(item, active))) return false;
    } else if (!valuesEqual(value, active)) return false;
  }
  return true;
}

function scopedObjects(
  page: JuanPageDocument,
  state: PageState,
  ignoreScopes: readonly string[] = [],
): PageObject[] {
  return page.objects.filter((object) => objectMatchesScopes(object, page, state, ignoreScopes));
}

function matchesFilter(object: PageObject, metric: PageMetric, state: PageState): boolean {
  if (!("filter" in metric) || !metric.filter) return true;
  return valuesEqual(objectValue(object, metric.filter.field, state), metric.filter.equals);
}

function metricRawValue(metric: PageMetric, page: JuanPageDocument, state: PageState): PageScalar {
  const objects = scopedObjects(page, state, metric.ignoreScopes).filter((object) => matchesFilter(object, metric, state));
  if (metric.operation === "value") return metric.value;
  if (metric.operation === "count") return objects.length;
  if (metric.operation === "sum") {
    return objects.reduce((total, object) => {
      const value = objectValue(object, metric.field, state);
      return total + (typeof value === "number" ? value : 0);
    }, 0);
  }
  if (metric.operation === "sum-product") {
    return objects.reduce((total, object) => {
      const left = objectValue(object, metric.leftField, state);
      const right = objectValue(object, metric.rightField, state);
      return total + (typeof left === "number" ? left : 0) * (typeof right === "number" ? right : 0);
    }, 0);
  }
  const done = objects.filter((object) => Boolean(objectValue(object, metric.field, state))).length;
  return objects.length ? done / objects.length : 0;
}

function metricText(metric: PageMetric, page: JuanPageDocument, state: PageState): string {
  const value = metricRawValue(metric, page, state);
  return typeof value === "number" ? formatNumber(value, metric.format, metric.currency) : scalarText(value);
}

function projectionPoints(projection: PageProjection, page: JuanPageDocument, state: PageState): ProjectionPoint[] {
  const source = scopedObjects(page, state, projection.ignoreScopes).filter((object) =>
    (!projection.sourceType || object.type === projection.sourceType)
    && (!projection.sourceGroup || object.group === projection.sourceGroup),
  );
  const buckets = new Map<string, { key: PageScalar; total: number; count: number }>();
  for (const object of source) {
    const dimension = objectValue(object, projection.dimension, state);
    if (dimension === undefined || dimension === null || Array.isArray(dimension)) continue;
    const bucketKey = JSON.stringify(dimension);
    const bucket = buckets.get(bucketKey) ?? { key: dimension as PageScalar, total: 0, count: 0 };
    bucket.count += 1;
    if (projection.operation !== "count") {
      const measure = objectValue(object, projection.measure, state);
      if (typeof measure === "number") bucket.total += measure;
    }
    buckets.set(bucketKey, bucket);
  }
  let points = [...buckets.values()].map((bucket) => ({
    id: scalarText(bucket.key),
    key: bucket.key,
    label: scalarText(bucket.key),
    value: projection.operation === "count" ? bucket.count : projection.operation === "average" ? (bucket.count ? bucket.total / bucket.count : 0) : bucket.total,
  }));
  points.sort((left, right) => {
    const order = projection.order === "desc" ? -1 : 1;
    return left.label.localeCompare(right.label, undefined, { numeric: true }) * order;
  });
  if (projection.limit) points = points.slice(0, projection.limit);
  return points;
}

function objectText(object: PageObject, state: PageState): string {
  return [
    object.name,
    object.type,
    object.group,
    object.status,
    object.summary,
    ...(object.tags ?? []),
    ...(object.fields ?? []).flatMap((field) => [field.label, scalarText(objectValue(object, field.key, state))]),
  ].filter(Boolean).join(" ").toLowerCase();
}

function copyObject(object: PageObject, state: PageState): string {
  const lines = [object.name, object.summary ?? ""];
  for (const field of object.fields ?? []) {
    if (field.display !== "hidden") lines.push(`${field.label ?? humanizeKey(field.key)}: ${formatValue(objectValue(object, field.key, state), field)}`);
  }
  return lines.filter(Boolean).join("\n");
}

export function renderPage(page: JuanPageDocument, mount: HTMLElement, options: UniversalRenderOptions = {}): RenderHandle {
  applyTheme(page.theme);
  document.title = `${page.title} · JuanPager`;
  const key = pageStateKey(page);
  const state = loadPageState(key, page);
  const affordanceMap = new Map((page.affordances ?? []).map((affordance) => [affordance.id, affordance]));
  const bindingsByTarget = new Map<string, PageBinding[]>();
  for (const binding of page.bindings ?? []) {
    const bindingKey = targetKey(binding.target);
    bindingsByTarget.set(bindingKey, [...(bindingsByTarget.get(bindingKey) ?? []), binding]);
  }
  let query = "";

  const persist = (): void => savePageState(key, state);
  const bindingsFor = (target: PageBindingTarget): PageBinding[] => bindingsByTarget.get(targetKey(target)) ?? [];
  const resolvedBindings = (target: PageBindingTarget): Array<{ binding: PageBinding; affordance: PageAffordance }> =>
    bindingsFor(target)
      .map((binding) => ({ binding, affordance: affordanceMap.get(binding.affordance) }))
      .filter((entry): entry is { binding: PageBinding; affordance: PageAffordance } => Boolean(entry.affordance));

  const notify = async (affordance: PageAffordance, binding: PageBinding, value?: PageScalar): Promise<void> => {
    if (!options.onAffordance) return;
    const objectId = binding.target.kind === "object" || binding.target.kind === "field" ? binding.target.object : undefined;
    await options.onAffordance({
      affordanceId: affordance.id,
      effect: affordance.effect.kind,
      target: binding.target,
      objectId,
      value,
      operation: affordance.effect.kind === "invoke" ? affordance.effect.operation : undefined,
      values: state.values,
      scopes: state.scopes,
      selections: state.selections,
    });
  };

  const copyText = (affordance: PageAffordance, binding: PageBinding): string => {
    if (affordance.effect.kind !== "copy") return "";
    if (affordance.effect.source === "page") return JSON.stringify(page, null, 2);
    if (affordance.effect.source === "url") return affordance.effect.url ?? window.location.href;
    const objectId = binding.target.kind === "object" || binding.target.kind === "field" ? binding.target.object : undefined;
    const object = objectId ? pageObject(page, objectId) : undefined;
    if (affordance.effect.source === "object" && object) return copyObject(object, state);
    if (affordance.effect.source === "field" && object && affordance.effect.field) {
      return scalarText(objectValue(object, affordance.effect.field, state));
    }
    return window.location.href;
  };

  const run = async (
    affordance: PageAffordance,
    binding: PageBinding,
    value?: PageScalar,
    host?: HTMLElement,
  ): Promise<void> => {
    const effect = affordance.effect;
    if (effect.kind === "inspect") {
      state.inspection = binding.target;
      persist();
      draw();
      await notify(affordance, binding, value);
      return;
    }
    if (effect.kind === "set") {
      const objectId = binding.target.kind === "object" || binding.target.kind === "field" ? binding.target.object : undefined;
      if (!objectId || value === undefined) return;
      setPageValue(state, objectId, effect.field, value);
      persist();
      draw();
      return;
    }
    if (effect.kind === "scope") {
      const next = value ?? binding.value ?? null;
      setPageScope(state, effect.scope, next);
      persist();
      draw();
      return;
    }
    if (effect.kind === "select") {
      const candidate = binding.value ?? value
        ?? (binding.target.kind === "object" || binding.target.kind === "field" ? binding.target.object : null);
      if (candidate === null || candidate === undefined) return;
      const idValue = String(candidate);
      const current = state.selections[effect.selection] ?? [];
      const next = effect.mode === "single"
        ? (current.includes(idValue) ? [] : [idValue])
        : current.includes(idValue) ? current.filter((item) => item !== idValue) : [...current, idValue];
      setPageSelection(state, effect.selection, next);
      persist();
      draw();
      return;
    }
    if (effect.kind === "copy") {
      await navigator.clipboard.writeText(copyText(affordance, binding));
      if (host) announce(host, "Copied");
      await notify(affordance, binding, value);
      return;
    }
    if (effect.kind === "navigate") {
      await notify(affordance, binding, value);
      window.open(effect.url, "_blank", "noopener,noreferrer");
      return;
    }
    await notify(affordance, binding, value);
    if (host) announce(host, effect.policy === "approval" ? "Proposal recorded" : "Request sent");
  };

  const currentInputValue = (affordance: PageAffordance, binding: PageBinding): PageScalar | undefined => {
    if (affordance.effect.kind === "scope") return state.scopes[affordance.effect.scope];
    if (affordance.effect.kind === "set") {
      const objectId = binding.target.kind === "object" || binding.target.kind === "field" ? binding.target.object : undefined;
      const object = objectId ? pageObject(page, objectId) : undefined;
      return object ? effectiveFieldValue(object, affordance.effect.field, state) as PageScalar | undefined : undefined;
    }
    return binding.value;
  };

  const control = (binding: PageBinding, compact = false): HTMLElement => {
    const affordance = affordanceMap.get(binding.affordance);
    const host = el("div", { className: `jp-u-affordance${compact ? " is-compact" : ""}`, attrs: { "data-affordance-id": binding.affordance } });
    if (!affordance) return host;
    const fixed = binding.value;
    const input = affordance.input;
    const label = affordance.label;

    if (affordance.effect.kind === "navigate") {
      const link = externalLink(affordance.effect.url, label, `jp-u-button jp-u-${affordance.tone ?? "neutral"}`);
      link.setAttribute("data-affordance-id", affordance.id);
      link.addEventListener("click", () => { void notify(affordance, binding, fixed); });
      return link;
    }

    if (fixed !== undefined || input.kind === "none") {
      const selected = affordance.effect.kind === "select"
        ? (state.selections[affordance.effect.selection] ?? []).includes(String(fixed ?? (binding.target.kind === "object" ? binding.target.object : "")))
        : false;
      const button = el("button", {
        className: `jp-u-button jp-u-${affordance.tone ?? "neutral"}${selected ? " is-active" : ""}`,
        text: fixed !== undefined && input.kind === "choice"
          ? input.options.find((option) => valuesEqual(option.value, fixed))?.label ?? label
          : label,
        attrs: {
          type: "button",
          "data-affordance-id": affordance.id,
          "aria-pressed": affordance.effect.kind === "select" ? selected : undefined,
        },
      });
      button.addEventListener("click", () => { void run(affordance, binding, fixed, host); });
      append(host, button);
      return host;
    }

    const fieldLabel = el("label", { className: "jp-u-affordance-label" });
    append(fieldLabel, el("span", { text: label }));
    const current = currentInputValue(affordance, binding);

    if (input.kind === "boolean") {
      const checkbox = el("input", { attrs: { type: "checkbox", "data-affordance-id": affordance.id } }) as HTMLInputElement;
      checkbox.checked = Boolean(current);
      checkbox.addEventListener("change", () => { void run(affordance, binding, checkbox.checked, host); });
      fieldLabel.classList.add("is-toggle");
      append(fieldLabel, checkbox);
    }

    if (input.kind === "number") {
      const number = el("input", {
        attrs: {
          type: input.presentation === "adjust" ? "range" : "number",
          value: typeof current === "number" ? current : input.min ?? 0,
          min: input.min,
          max: input.max,
          step: input.step ?? 1,
          "data-affordance-id": affordance.id,
        },
      }) as HTMLInputElement;
      const output = input.presentation === "adjust" ? el("output", { className: "jp-u-range-value", text: number.value }) : undefined;
      number.addEventListener("input", () => { if (output) output.textContent = number.value; });
      number.addEventListener("change", () => { void run(affordance, binding, Number(number.value), host); });
      append(fieldLabel, number, output);
    }

    if (input.kind === "choice") {
      const select = el("select", { attrs: { "data-affordance-id": affordance.id } }) as HTMLSelectElement;
      input.options.forEach((option, index) => append(select, el("option", { text: option.label, attrs: { value: String(index) } })));
      const selectedIndex = input.options.findIndex((option) => valuesEqual(option.value, current));
      select.value = String(selectedIndex >= 0 ? selectedIndex : 0);
      select.addEventListener("change", () => {
        const option = input.options[Number(select.value)];
        if (option) void run(affordance, binding, option.value, host);
      });
      append(fieldLabel, select);
    }

    if (input.kind === "text") {
      const textInput = input.multiline
        ? el("textarea", { attrs: { placeholder: input.placeholder ?? "", "data-affordance-id": affordance.id } }) as HTMLTextAreaElement
        : el("input", { attrs: { type: "text", placeholder: input.placeholder ?? "", "data-affordance-id": affordance.id } }) as HTMLInputElement;
      textInput.value = typeof current === "string" ? current : "";
      textInput.addEventListener("change", () => { void run(affordance, binding, textInput.value, host); });
      append(fieldLabel, textInput);
    }

    append(host, fieldLabel);
    return host;
  };

  const visibleObjects = (): PageObject[] => scopedObjects(page, state).filter((object) => {
    const groupMatch = !state.activeGroup || state.activeGroup === "all" || (object.group ?? "Other") === state.activeGroup;
    return groupMatch && (!query || objectText(object, state).includes(query));
  });

  const card = (object: PageObject): HTMLElement => {
    const objectTarget: PageBindingTarget = { kind: "object", object: object.id };
    const objectBindings = resolvedBindings(objectTarget);
    const inspect = objectBindings.find((entry) => entry.affordance.effect.kind === "inspect");
    const selected = [...Object.values(state.selections)].some((values) => values.includes(object.id));
    const article = el("article", {
      className: `jp-u-card jp-u-tone-${object.tone ?? "neutral"}${inspect ? " is-interactive" : ""}${selected ? " is-selected" : ""}`,
      attrs: {
        "data-object-id": object.id,
        tabindex: inspect ? "0" : undefined,
        role: inspect ? "button" : undefined,
        "aria-label": inspect ? `Inspect ${object.name}` : undefined,
      },
    });
    if (object.imageUrl) append(article, imageWithFallback(object.imageUrl, object.name, "jp-u-image"));
    const head = el("div", { className: "jp-u-card-head" });
    append(head, el("span", { className: "jp-u-type", text: humanizeKey(object.type) }));
    if (object.status) append(head, el("span", { className: "jp-u-status", text: object.status }));
    append(article, head, el("h3", { text: object.name }));
    if (object.summary) append(article, el("p", { className: "jp-u-summary", text: object.summary }));

    const prominent = (object.fields ?? []).filter((field) => field.display === "prominent");
    if (prominent.length) {
      const values = el("div", { className: "jp-u-prominent" });
      for (const field of prominent) append(values, el("div", { text: formatValue(objectValue(object, field.key, state), field) }));
      append(article, values);
    }

    const inline = el("div", { className: "jp-u-inline-affordances" });
    for (const field of object.fields ?? []) {
      const target: PageBindingTarget = { kind: "field", object: object.id, field: field.key };
      for (const { binding, affordance } of resolvedBindings(target)) {
        if (affordance.effect.kind !== "inspect") append(inline, control(binding, true));
      }
    }
    if (inline.childElementCount) append(article, inline);

    const actions = el("div", { className: "jp-u-card-actions" });
    for (const { binding, affordance } of objectBindings) {
      if (affordance.effect.kind !== "inspect" && affordance.effect.kind !== "set") append(actions, control(binding, true));
    }
    if (actions.childElementCount) append(article, actions);

    if (inspect) {
      const open = (): void => { void run(inspect.affordance, inspect.binding); };
      article.addEventListener("click", (event) => {
        if (!(event.target as Element).closest("button,a,input,select,textarea,label")) open();
      });
      article.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    }
    return article;
  };

  const projectionView = (projection: PageProjection): HTMLElement => {
    const section = el("section", { className: "jp-u-projection", attrs: { "data-projection-id": projection.id } });
    append(section, el("h2", { text: projection.label }));
    if (projection.description) append(section, el("p", { className: "jp-u-summary", text: projection.description }));
    const points = projectionPoints(projection, page, state);
    const max = Math.max(1, ...points.map((point) => Math.abs(point.value)));
    const projectionBindings = resolvedBindings({ kind: "projection", projection: projection.id });
    const primary = projectionBindings.find((entry) => entry.binding.priority === "primary") ?? projectionBindings[0];
    const list = el("div", { className: "jp-u-projection-points" });
    for (const point of points) {
      const content = el("span", { className: "jp-u-projection-point-content" });
      append(
        content,
        el("span", { className: "jp-u-projection-label", text: point.label }),
        el("span", { className: "jp-u-projection-track" }),
        el("strong", { text: formatNumber(point.value, projection.format, projection.currency) }),
      );
      const track = content.querySelector(".jp-u-projection-track") as HTMLElement;
      append(track, el("span", { className: "jp-u-projection-bar", attrs: { style: `width:${Math.max(2, Math.abs(point.value) / max * 100)}%` } }));
      if (primary) {
        const selected = primary.affordance.effect.kind === "scope"
          ? valuesEqual(state.scopes[primary.affordance.effect.scope], point.key)
          : primary.affordance.effect.kind === "select"
            ? (state.selections[primary.affordance.effect.selection] ?? []).includes(point.id)
            : false;
        const button = el("button", {
          className: `jp-u-projection-point${selected ? " is-active" : ""}`,
          attrs: {
            type: "button",
            "data-affordance-id": primary.affordance.id,
            "data-datum-id": point.id,
            "aria-pressed": primary.affordance.effect.kind === "scope" || primary.affordance.effect.kind === "select" ? selected : undefined,
          },
        });
        append(button, content);
        button.addEventListener("click", () => { void run(primary.affordance, primary.binding, primary.affordance.effect.kind === "select" ? point.id : point.key, section); });
        append(list, button);
      } else {
        const row = el("div", { className: "jp-u-projection-point is-display" });
        append(row, content);
        append(list, row);
      }
    }
    if (!points.length) append(list, el("p", { className: "jp-u-empty", text: "No data in the current scope." }));
    append(section, list);
    return section;
  };

  const metricView = (metric: PageMetric): HTMLElement => {
    const target: PageBindingTarget = { kind: "metric", metric: metric.id };
    const binding = resolvedBindings(target)[0];
    const content = el("span", { className: "jp-u-metric-content" });
    append(content, el("strong", { text: metricText(metric, page, state) }), el("span", { text: metric.label }));
    if (!binding) {
      const item = el("div", { className: "jp-u-metric", attrs: { "data-metric-id": metric.id } });
      append(item, content);
      return item;
    }
    const button = el("button", { className: "jp-u-metric is-interactive", attrs: { type: "button", "data-metric-id": metric.id, "data-affordance-id": binding.affordance.id } });
    append(button, content);
    button.addEventListener("click", () => { void run(binding.affordance, binding.binding, binding.binding.value, button); });
    return button;
  };

  const inspector = (target: PageBindingTarget): HTMLElement => {
    const panel = el("aside", { className: "jp-u-inspector", attrs: { "aria-label": "Details" } });
    const close = el("button", { className: "jp-u-close", text: "Close", attrs: { type: "button" } });
    close.addEventListener("click", () => { state.inspection = undefined; persist(); draw(); });
    append(panel, close);

    if (target.kind === "page") {
      append(panel, el("p", { className: "jp-u-type", text: "Page" }), el("h2", { text: page.title }));
      if (page.description) append(panel, el("p", { className: "jp-u-summary", text: page.description }));
    }

    if (target.kind === "object" || target.kind === "field") {
      const object = pageObject(page, target.object);
      if (object) {
        append(panel, el("p", { className: "jp-u-type", text: humanizeKey(object.type) }), el("h2", { text: object.name }));
        if (object.summary) append(panel, el("p", { className: "jp-u-summary", text: object.summary }));
        const details = el("dl", { className: "jp-u-details" });
        for (const field of object.fields ?? []) {
          if (field.display !== "hidden") {
            const focused = target.kind === "field" && target.field === field.key;
            append(details, el("dt", { className: focused ? "is-focused" : undefined, text: field.label ?? humanizeKey(field.key) }), el("dd", { className: focused ? "is-focused" : undefined, text: formatValue(objectValue(object, field.key, state), field) }));
          }
        }
        append(panel, details);
        const controls = el("div", { className: "jp-u-actions" });
        for (const { binding, affordance } of resolvedBindings({ kind: "object", object: object.id })) if (affordance.effect.kind !== "inspect") append(controls, control(binding));
        for (const field of object.fields ?? []) {
          for (const { binding, affordance } of resolvedBindings({ kind: "field", object: object.id, field: field.key })) if (affordance.effect.kind !== "inspect") append(controls, control(binding));
        }
        if (controls.childElementCount) append(panel, controls);
      }
    }

    if (target.kind === "metric") {
      const metric = page.metrics?.find((item) => item.id === target.metric);
      if (metric) append(panel, el("p", { className: "jp-u-type", text: "Metric" }), el("h2", { text: metric.label }), el("p", { className: "jp-u-inspector-value", text: metricText(metric, page, state) }));
    }

    if (target.kind === "projection") {
      const projection = page.projections?.find((item) => item.id === target.projection);
      if (projection) {
        append(panel, el("p", { className: "jp-u-type", text: "Projection" }), el("h2", { text: projection.label }));
        const list = el("dl", { className: "jp-u-details" });
        for (const point of projectionPoints(projection, page, state)) append(list, el("dt", { text: point.label }), el("dd", { text: formatNumber(point.value, projection.format, projection.currency) }));
        append(panel, list);
      }
    }

    if (target.kind === "relation") {
      const relation = page.relations?.find((item) => item.id === target.relation);
      if (relation) {
        append(
          panel,
          el("p", { className: "jp-u-type", text: "Relationship" }),
          el("h2", { text: relation.label ?? humanizeKey(relation.kind) }),
          el("p", { text: `${pageObject(page, relation.from)?.name ?? relation.from} → ${pageObject(page, relation.to)?.name ?? relation.to}` }),
        );
      }
    }
    return panel;
  };

  function draw(): void {
    const root = el("div", { className: "jp-u-page" });
    const header = el("header", { className: "jp-u-header" });
    const top = el("div", { className: "jp-u-topline" });
    const brand = el("div", { className: "jp-u-brandline" });
    append(brand, el("span", { className: "jp-u-brand", text: "JUAN" }), el("span", { text: "Semantic surface" }));
    const utility = el("div", { className: "jp-u-utility" });
    if (options.builderHref) append(utility, el("a", { className: "jp-u-button is-quiet", text: "Build", attrs: { href: options.builderHref } }));
    const share = el("button", { className: "jp-u-button jp-u-primary", text: "Share", attrs: { type: "button" } });
    share.addEventListener("click", () => { void (async () => { const url = options.onShare ? await options.onShare() : window.location.href; await navigator.clipboard.writeText(url); announce(header, "Share link copied"); })(); });
    const reset = el("button", { className: "jp-u-button is-quiet", text: "Reset", attrs: { type: "button" } });
    reset.addEventListener("click", () => {
      resetPageState(key);
      const fresh = loadPageState(key, page);
      state.values = fresh.values;
      state.scopes = fresh.scopes;
      state.selections = fresh.selections;
      state.inspection = undefined;
      state.activeGroup = undefined;
      query = "";
      draw();
    });
    append(utility, share, reset);
    append(top, brand, utility);
    append(header, top, el("h1", { text: page.title }));
    if (page.intent) append(header, el("p", { className: "jp-u-intent", text: page.intent }));
    if (page.description) append(header, el("p", { className: "jp-u-description", text: page.description }));
    if (page.metrics?.length) {
      const metrics = el("div", { className: "jp-u-metrics" });
      for (const metric of page.metrics) append(metrics, metricView(metric));
      append(header, metrics);
    }

    const controls = el("div", { className: "jp-u-controls" });
    for (const { binding } of resolvedBindings({ kind: "page" })) append(controls, control(binding));
    if (page.objects.length > 6) {
      const search = el("input", { attrs: { type: "search", placeholder: "Search", value: query, "aria-label": "Search objects" } }) as HTMLInputElement;
      search.addEventListener("change", () => { query = search.value.trim().toLowerCase(); draw(); });
      append(controls, search);
    }
    const groups = [...new Set(scopedObjects(page, state).map((object) => object.group ?? "Other"))];
    if (groups.length > 1) {
      const select = el("select", { attrs: { "aria-label": "Filter group" } }) as HTMLSelectElement;
      append(select, el("option", { text: "All groups", attrs: { value: "all" } }));
      for (const group of groups) append(select, el("option", { text: group, attrs: { value: group } }));
      select.value = state.activeGroup ?? "all";
      select.addEventListener("change", () => { state.activeGroup = select.value; persist(); draw(); });
      append(controls, select);
    }
    for (const [scopeId, value] of Object.entries(state.scopes)) {
      if (value === null || value === undefined) continue;
      const chip = el("button", { className: "jp-u-scope-chip", text: `${humanizeKey(scopeId)}: ${scalarText(value)} ×`, attrs: { type: "button", title: "Clear scope" } });
      chip.addEventListener("click", () => { setPageScope(state, scopeId, null); persist(); draw(); });
      append(controls, chip);
    }

    const workspace = el("main", { className: "jp-u-workspace" });
    if (page.projections?.length) {
      const projections = el("div", { className: "jp-u-projections" });
      for (const projection of page.projections) append(projections, projectionView(projection));
      append(workspace, projections);
    }

    const objects = visibleObjects();
    if (!objects.length) {
      append(workspace, el("p", { className: "jp-u-empty", text: "No objects match the current scope." }));
    } else {
      const buckets = new Map<string, PageObject[]>();
      for (const object of objects) {
        const group = object.group ?? "Other";
        buckets.set(group, [...(buckets.get(group) ?? []), object]);
      }
      const groupsRoot = el("div", { className: "jp-u-groups" });
      for (const [name, items] of buckets) {
        const section = el("section", { className: "jp-u-group" });
        const title = el("div", { className: "jp-u-group-title" });
        append(title, el("h2", { text: name }), el("span", { className: "jp-u-count", text: String(items.length) }));
        const grid = el("div", { className: "jp-u-grid" });
        for (const object of items) append(grid, card(object));
        append(section, title, grid);
        append(groupsRoot, section);
      }
      append(workspace, groupsRoot);
    }

    if (page.relations?.length) {
      const relations = el("section", { className: "jp-u-relations" });
      append(relations, el("h2", { text: "Relationships" }));
      for (const relation of page.relations) {
        const target: PageBindingTarget = { kind: "relation", relation: relation.id };
        const inspect = resolvedBindings(target).find((entry) => entry.affordance.effect.kind === "inspect");
        const text = `${pageObject(page, relation.from)?.name ?? relation.from} → ${relation.label ?? humanizeKey(relation.kind)} → ${pageObject(page, relation.to)?.name ?? relation.to}`;
        if (inspect) {
          const button = el("button", { className: "jp-u-relation", text, attrs: { type: "button" } });
          button.addEventListener("click", () => { void run(inspect.affordance, inspect.binding); });
          append(relations, button);
        } else append(relations, el("p", { text }));
      }
      append(workspace, relations);
    }

    append(root, header);
    if (controls.childElementCount) append(root, controls);
    append(root, workspace);
    if (state.inspection) append(root, inspector(state.inspection));
    mount.replaceChildren(root);
  }

  draw();
  return { root: mount.firstElementChild as HTMLElement, destroy: () => mount.replaceChildren() };
}
