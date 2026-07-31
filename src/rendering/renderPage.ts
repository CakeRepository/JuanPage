import { announce, append, el, externalLink, imageWithFallback } from "./dom.js";
import { applyTheme, type RenderHandle } from "./render.js";
import {
  humanizeKey,
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

type BoundAffordance = Readonly<{ binding: PageBinding; affordance: PageAffordance }>;
type ProjectionPoint = Readonly<{ id: string; key: PageScalar; label: string; value: number }>;

function scalarText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.map(scalarText).join(" · ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatNumber(
  value: number,
  format: "auto" | "number" | "currency" | "percent" | undefined,
  currency = "USD",
): string {
  if (format === "currency") return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  if (format === "percent") return `${Math.round(value * 100)}%`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatValue(value: unknown, field?: PageField): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.map(scalarText).join(" · ");
  if (typeof value === "number") {
    const format = field?.format === "number" || field?.format === "currency" || field?.format === "percent"
      ? field.format
      : "auto";
    return formatNumber(value, format, field?.currency);
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

function sameValue(left: unknown, right: unknown): boolean {
  return left === right || String(left) === String(right);
}

function objectMatchesScopes(
  object: PageObject,
  page: JuanPageDocument,
  state: PageState,
  ignored: readonly string[] = [],
): boolean {
  for (const scope of page.scopes ?? []) {
    if (ignored.includes(scope.id)) continue;
    const active = state.scopes[scope.id];
    if (active === undefined || active === null) continue;
    if (scope.objectTypes?.length && !scope.objectTypes.includes(object.type)) continue;
    const value = objectValue(object, scope.field, state);
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      if (!value.some((item) => sameValue(item, active))) return false;
    } else if (!sameValue(value, active)) return false;
  }
  return true;
}

function scopedObjects(
  page: JuanPageDocument,
  state: PageState,
  ignored: readonly string[] = [],
): PageObject[] {
  return page.objects.filter((object) => objectMatchesScopes(object, page, state, ignored));
}

function matchesMetricFilter(object: PageObject, metric: PageMetric, state: PageState): boolean {
  if (!("filter" in metric) || !metric.filter) return true;
  return sameValue(objectValue(object, metric.filter.field, state), metric.filter.equals);
}

function metricValue(metric: PageMetric, page: JuanPageDocument, state: PageState): PageScalar {
  const objects = scopedObjects(page, state, metric.ignoreScopes).filter((object) => matchesMetricFilter(object, metric, state));
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
  const completed = objects.filter((object) => Boolean(objectValue(object, metric.field, state))).length;
  return objects.length ? completed / objects.length : 0;
}

function metricText(metric: PageMetric, page: JuanPageDocument, state: PageState): string {
  const value = metricValue(metric, page, state);
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
    const bucketId = JSON.stringify(dimension);
    const bucket = buckets.get(bucketId) ?? { key: dimension as PageScalar, total: 0, count: 0 };
    bucket.count += 1;
    if (projection.operation !== "count") {
      const measure = objectValue(object, projection.measure, state);
      if (typeof measure === "number") bucket.total += measure;
    }
    buckets.set(bucketId, bucket);
  }
  let points = [...buckets.values()].map((bucket) => ({
    id: scalarText(bucket.key),
    key: bucket.key,
    label: scalarText(bucket.key),
    value: projection.operation === "count"
      ? bucket.count
      : projection.operation === "average"
        ? (bucket.count ? bucket.total / bucket.count : 0)
        : bucket.total,
  }));
  const direction = projection.order === "desc" ? -1 : 1;
  points.sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }) * direction);
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

function bindingObjectId(target: PageBindingTarget): string | undefined {
  return target.kind === "object" || target.kind === "field" ? target.object : undefined;
}

export function renderPage(
  page: JuanPageDocument,
  mount: HTMLElement,
  options: UniversalRenderOptions = {},
): RenderHandle {
  applyTheme(page.theme);
  document.title = `${page.title} · JuanPager`;
  const storageKey = pageStateKey(page);
  const state = loadPageState(storageKey, page);
  const affordances = new Map((page.affordances ?? []).map((affordance) => [affordance.id, affordance]));
  const bindings = new Map<string, PageBinding[]>();
  for (const binding of page.bindings ?? []) {
    const key = targetKey(binding.target);
    bindings.set(key, [...(bindings.get(key) ?? []), binding]);
  }
  let query = "";

  const persist = (): void => savePageState(storageKey, state);
  const bound = (target: PageBindingTarget): BoundAffordance[] => {
    const result: BoundAffordance[] = [];
    for (const binding of bindings.get(targetKey(target)) ?? []) {
      const affordance = affordances.get(binding.affordance);
      if (affordance) result.push({ binding, affordance });
    }
    return result;
  };

  const notify = async (
    affordance: PageAffordance,
    binding: PageBinding,
    value?: PageScalar,
  ): Promise<void> => {
    if (!options.onAffordance) return;
    await options.onAffordance({
      affordanceId: affordance.id,
      effect: affordance.effect.kind,
      target: binding.target,
      objectId: bindingObjectId(binding.target),
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
    const objectId = bindingObjectId(binding.target);
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
      const objectId = bindingObjectId(binding.target);
      if (!objectId || value === undefined) return;
      setPageValue(state, objectId, effect.field, value);
      persist();
      draw();
      return;
    }
    if (effect.kind === "scope") {
      setPageScope(state, effect.scope, value ?? binding.value ?? null);
      persist();
      draw();
      return;
    }
    if (effect.kind === "select") {
      const candidate = value ?? binding.value ?? bindingObjectId(binding.target);
      if (candidate === undefined || candidate === null) return;
      const item = String(candidate);
      const current = state.selections[effect.selection] ?? [];
      const next = effect.mode === "single"
        ? (current.includes(item) ? [] : [item])
        : current.includes(item)
          ? current.filter((valueId) => valueId !== item)
          : [...current, item];
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
    if (affordance.effect.kind !== "set") return binding.value;
    const objectId = bindingObjectId(binding.target);
    const object = objectId ? pageObject(page, objectId) : undefined;
    return object ? effectiveFieldValue(object, affordance.effect.field, state) as PageScalar | undefined : undefined;
  };

  const control = (entry: BoundAffordance, compact = false): HTMLElement => {
    const { binding, affordance } = entry;
    const host = el("div", {
      className: `jp-u-affordance${compact ? " is-compact" : ""}`,
      attrs: { "data-affordance-id": affordance.id },
    });
    if (affordance.effect.kind === "navigate") {
      const link = externalLink(affordance.effect.url, affordance.label, `jp-u-button jp-u-${affordance.tone ?? "neutral"}`);
      link.setAttribute("data-affordance-id", affordance.id);
      link.addEventListener("click", () => { void notify(affordance, binding, binding.value); });
      return link;
    }

    if (binding.value !== undefined || affordance.input.kind === "none") {
      const selection = affordance.effect.kind === "select" ? state.selections[affordance.effect.selection] ?? [] : [];
      const candidate = binding.value ?? bindingObjectId(binding.target) ?? "";
      const selected = selection.includes(String(candidate));
      const button = el("button", {
        className: `jp-u-button jp-u-${affordance.tone ?? "neutral"}${selected ? " is-active" : ""}`,
        text: affordance.label,
        attrs: {
          type: "button",
          "aria-pressed": affordance.effect.kind === "select" ? selected : undefined,
        },
      });
      button.addEventListener("click", () => { void run(affordance, binding, binding.value, host); });
      append(host, button);
      return host;
    }

    const label = el("label", { className: "jp-u-affordance-label" });
    append(label, el("span", { text: affordance.label }));
    const current = currentInputValue(affordance, binding);

    if (affordance.input.kind === "boolean") {
      const input = el("input", { attrs: { type: "checkbox", "data-affordance-id": affordance.id } }) as HTMLInputElement;
      input.checked = Boolean(current);
      input.addEventListener("change", () => { void run(affordance, binding, input.checked, host); });
      label.classList.add("is-toggle");
      append(label, input);
    }

    if (affordance.input.kind === "number") {
      const input = el("input", {
        attrs: {
          type: affordance.input.presentation === "adjust" ? "range" : "number",
          value: typeof current === "number" ? current : affordance.input.min ?? 0,
          min: affordance.input.min,
          max: affordance.input.max,
          step: affordance.input.step ?? 1,
          "data-affordance-id": affordance.id,
        },
      }) as HTMLInputElement;
      const output = affordance.input.presentation === "adjust"
        ? el("output", { className: "jp-u-range-value", text: input.value })
        : undefined;
      input.addEventListener("input", () => { if (output) output.textContent = input.value; });
      input.addEventListener("change", () => { void run(affordance, binding, Number(input.value), host); });
      append(label, input, output);
    }

    if (affordance.input.kind === "choice") {
      const select = el("select", { attrs: { "data-affordance-id": affordance.id } }) as HTMLSelectElement;
      affordance.input.options.forEach((option, index) => {
        append(select, el("option", { text: option.label, attrs: { value: index } }));
      });
      const selectedIndex = affordance.input.options.findIndex((option) => sameValue(option.value, current));
      select.value = String(selectedIndex >= 0 ? selectedIndex : 0);
      select.addEventListener("change", () => {
        const option = affordance.input.kind === "choice" ? affordance.input.options[Number(select.value)] : undefined;
        if (option) void run(affordance, binding, option.value, host);
      });
      append(label, select);
    }

    if (affordance.input.kind === "text") {
      const input = affordance.input.multiline
        ? el("textarea", { attrs: { placeholder: affordance.input.placeholder ?? "", "data-affordance-id": affordance.id } }) as HTMLTextAreaElement
        : el("input", { attrs: { type: "text", placeholder: affordance.input.placeholder ?? "", "data-affordance-id": affordance.id } }) as HTMLInputElement;
      input.value = typeof current === "string" ? current : "";
      input.addEventListener("change", () => { void run(affordance, binding, input.value, host); });
      append(label, input);
    }

    append(host, label);
    return host;
  };

  const visibleObjects = (): PageObject[] => scopedObjects(page, state).filter((object) => {
    const groupVisible = !state.activeGroup || state.activeGroup === "all" || (object.group ?? "Other") === state.activeGroup;
    return groupVisible && (!query || objectText(object, state).includes(query));
  });

  const card = (object: PageObject): HTMLElement => {
    const objectEntries = bound({ kind: "object", object: object.id });
    const inspect = objectEntries.find((entry) => entry.affordance.effect.kind === "inspect");
    const selected = Object.values(state.selections).some((selection) => selection.includes(object.id));
    const article = el("article", {
      className: `jp-u-card jp-u-tone-${object.tone ?? "neutral"}${inspect ? " is-interactive" : ""}${selected ? " is-selected" : ""}`,
      attrs: {
        "data-object-id": object.id,
        tabindex: inspect ? 0 : undefined,
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
      const row = el("div", { className: "jp-u-prominent" });
      for (const field of prominent) append(row, el("div", { text: formatValue(objectValue(object, field.key, state), field) }));
      append(article, row);
    }

    const inline = el("div", { className: "jp-u-inline-affordances" });
    for (const field of object.fields ?? []) {
      for (const entry of bound({ kind: "field", object: object.id, field: field.key })) {
        if (entry.affordance.effect.kind !== "inspect") append(inline, control(entry, true));
      }
    }
    if (inline.childElementCount) append(article, inline);

    const actions = el("div", { className: "jp-u-card-actions" });
    for (const entry of objectEntries) {
      if (entry.affordance.effect.kind !== "inspect" && entry.affordance.effect.kind !== "set") {
        append(actions, control(entry, true));
      }
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
    const section = el("section", {
      className: "jp-u-projection",
      attrs: { "data-projection-id": projection.id },
    });
    append(section, el("h2", { text: projection.label }));
    if (projection.description) append(section, el("p", { className: "jp-u-summary", text: projection.description }));
    const points = projectionPoints(projection, page, state);
    const max = Math.max(1, ...points.map((point) => Math.abs(point.value)));
    const entries = bound({ kind: "projection", projection: projection.id });
    const primary = entries.find((entry) => entry.binding.priority === "primary") ?? entries[0];
    const list = el("div", { className: "jp-u-projection-points" });

    for (const point of points) {
      const content = el("span", { className: "jp-u-projection-point-content" });
      const track = el("span", { className: "jp-u-projection-track" });
      append(track, el("span", {
        className: "jp-u-projection-bar",
        attrs: { style: `width:${Math.max(2, Math.abs(point.value) / max * 100)}%` },
      }));
      append(
        content,
        el("span", { className: "jp-u-projection-label", text: point.label }),
        track,
        el("strong", { text: formatNumber(point.value, projection.format, projection.currency) }),
      );

      if (!primary) {
        const row = el("div", { className: "jp-u-projection-point is-display" });
        append(row, content);
        append(list, row);
        continue;
      }

      const active = primary.affordance.effect.kind === "scope"
        ? sameValue(state.scopes[primary.affordance.effect.scope], point.key)
        : primary.affordance.effect.kind === "select"
          ? (state.selections[primary.affordance.effect.selection] ?? []).includes(point.id)
          : false;
      const button = el("button", {
        className: `jp-u-projection-point${active ? " is-active" : ""}`,
        attrs: {
          type: "button",
          "data-affordance-id": primary.affordance.id,
          "data-datum-id": point.id,
          "aria-pressed": primary.affordance.effect.kind === "scope" || primary.affordance.effect.kind === "select" ? active : undefined,
        },
      });
      append(button, content);
      button.addEventListener("click", () => {
        void run(
          primary.affordance,
          primary.binding,
          primary.affordance.effect.kind === "select" ? point.id : point.key,
          section,
        );
      });
      append(list, button);
    }

    if (!points.length) append(list, el("p", { className: "jp-u-empty", text: "No data in the current scope." }));
    append(section, list);
    return section;
  };

  const metricView = (metric: PageMetric): HTMLElement => {
    const entry = bound({ kind: "metric", metric: metric.id })[0];
    const content = el("span", { className: "jp-u-metric-content" });
    append(content, el("strong", { text: metricText(metric, page, state) }), el("span", { text: metric.label }));
    if (!entry) {
      const item = el("div", { className: "jp-u-metric", attrs: { "data-metric-id": metric.id } });
      append(item, content);
      return item;
    }
    const button = el("button", {
      className: "jp-u-metric is-interactive",
      attrs: {
        type: "button",
        "data-metric-id": metric.id,
        "data-affordance-id": entry.affordance.id,
      },
    });
    append(button, content);
    button.addEventListener("click", () => { void run(entry.affordance, entry.binding, entry.binding.value, button); });
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
          if (field.display === "hidden") continue;
          const focused = target.kind === "field" && target.field === field.key;
          append(
            details,
            el("dt", { className: focused ? "is-focused" : undefined, text: field.label ?? humanizeKey(field.key) }),
            el("dd", { className: focused ? "is-focused" : undefined, text: formatValue(objectValue(object, field.key, state), field) }),
          );
        }
        append(panel, details);
        const controls = el("div", { className: "jp-u-actions" });
        for (const entry of bound({ kind: "object", object: object.id })) {
          if (entry.affordance.effect.kind !== "inspect") append(controls, control(entry));
        }
        for (const field of object.fields ?? []) {
          for (const entry of bound({ kind: "field", object: object.id, field: field.key })) {
            if (entry.affordance.effect.kind !== "inspect") append(controls, control(entry));
          }
        }
        if (controls.childElementCount) append(panel, controls);
      }
    }

    if (target.kind === "metric") {
      const metric = page.metrics?.find((candidate) => candidate.id === target.metric);
      if (metric) append(panel, el("p", { className: "jp-u-type", text: "Metric" }), el("h2", { text: metric.label }), el("p", { className: "jp-u-inspector-value", text: metricText(metric, page, state) }));
    }

    if (target.kind === "projection") {
      const projection = page.projections?.find((candidate) => candidate.id === target.projection);
      if (projection) {
        append(panel, el("p", { className: "jp-u-type", text: "Projection" }), el("h2", { text: projection.label }));
        const details = el("dl", { className: "jp-u-details" });
        for (const point of projectionPoints(projection, page, state)) {
          append(details, el("dt", { text: point.label }), el("dd", { text: formatNumber(point.value, projection.format, projection.currency) }));
        }
        append(panel, details);
      }
    }

    if (target.kind === "relation") {
      const relation = page.relations?.find((candidate) => candidate.id === target.relation);
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
    share.addEventListener("click", () => {
      void (async () => {
        const url = options.onShare ? await options.onShare() : window.location.href;
        await navigator.clipboard.writeText(url);
        announce(header, "Share link copied");
      })();
    });
    const reset = el("button", { className: "jp-u-button is-quiet", text: "Reset", attrs: { type: "button" } });
    reset.addEventListener("click", () => {
      resetPageState(storageKey);
      const fresh = loadPageState(storageKey, page);
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
    for (const entry of bound({ kind: "page" })) append(controls, control(entry));
    if (page.objects.length > 6) {
      const search = el("input", { attrs: { type: "search", placeholder: "Search", value: query, "aria-label": "Search objects" } }) as HTMLInputElement;
      search.addEventListener("change", () => { query = search.value.trim().toLowerCase(); draw(); });
      append(controls, search);
    }
    const groupNames = [...new Set(scopedObjects(page, state).map((object) => object.group ?? "Other"))];
    if (groupNames.length > 1) {
      const select = el("select", { attrs: { "aria-label": "Filter group" } }) as HTMLSelectElement;
      append(select, el("option", { text: "All groups", attrs: { value: "all" } }));
      for (const group of groupNames) append(select, el("option", { text: group, attrs: { value: group } }));
      select.value = state.activeGroup ?? "all";
      select.addEventListener("change", () => { state.activeGroup = select.value; persist(); draw(); });
      append(controls, select);
    }
    for (const [scopeId, value] of Object.entries(state.scopes)) {
      if (value === undefined || value === null) continue;
      const chip = el("button", {
        className: "jp-u-scope-chip",
        text: `${humanizeKey(scopeId)}: ${scalarText(value)} ×`,
        attrs: { type: "button", title: "Clear scope" },
      });
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
      const groupRoot = el("div", { className: "jp-u-groups" });
      for (const [name, items] of buckets) {
        const section = el("section", { className: "jp-u-group" });
        const title = el("div", { className: "jp-u-group-title" });
        append(title, el("h2", { text: name }), el("span", { className: "jp-u-count", text: String(items.length) }));
        const grid = el("div", { className: "jp-u-grid" });
        for (const object of items) append(grid, card(object));
        append(section, title, grid);
        append(groupRoot, section);
      }
      append(workspace, groupRoot);
    }

    if (page.relations?.length) {
      const relations = el("section", { className: "jp-u-relations" });
      append(relations, el("h2", { text: "Relationships" }));
      for (const relation of page.relations) {
        const inspect = bound({ kind: "relation", relation: relation.id }).find((entry) => entry.affordance.effect.kind === "inspect");
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
  return {
    root: mount.firstElementChild as HTMLElement,
    destroy: () => mount.replaceChildren(),
  };
}
