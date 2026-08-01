import { parseFragment } from "../encoding/fragment.js";
import { decodePagePayload, type PagePayloadEncoding } from "../encoding/pagePipeline.js";
import { interactionLedgerFromMeaningSession, interactionLedgerFromPage } from "../encoding/shareableInteraction.js";
import { humanizeKey, type JuanPageDocument, type PageScalar } from "../schema/page.js";

export type ReturnedUrlChange = Readonly<{
  id: string;
  label: string;
  before?: PageScalar | readonly string[];
  after?: PageScalar | readonly string[];
}>;

export type ReturnedUrlInspection = Readonly<{
  version: 1;
  kind: "juanpage" | "m1" | "m1-session";
  title: string;
  interactionCount: number;
  activity: readonly Readonly<{ label: string; count: number }>[];
  changes: readonly ReturnedUrlChange[];
  warnings: readonly string[];
}>;

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function withoutActivity(page: JuanPageDocument): JuanPageDocument["objects"] {
  return page.objects.filter((object) => object.id !== "juanpager:activity");
}

function effectiveScopes(page: JuanPageDocument): Record<string, PageScalar> {
  const result: Record<string, PageScalar> = {};
  for (const scope of page.scopes ?? []) if (scope.initial !== undefined) result[scope.id] = scope.initial;
  return { ...result, ...(page.state?.scopes ?? {}) };
}

function fieldChanges(baseline: JuanPageDocument, current: JuanPageDocument): ReturnedUrlChange[] {
  const beforeObjects = new Map(withoutActivity(baseline).map((object) => [object.id, object]));
  const afterObjects = new Map(withoutActivity(current).map((object) => [object.id, object]));
  const changes: ReturnedUrlChange[] = [];
  for (const objectId of new Set([...beforeObjects.keys(), ...afterObjects.keys()])) {
    const beforeObject = beforeObjects.get(objectId);
    const afterObject = afterObjects.get(objectId);
    const beforeFields = new Map((beforeObject?.fields ?? []).map((field) => [field.key, field]));
    const afterFields = new Map((afterObject?.fields ?? []).map((field) => [field.key, field]));
    for (const key of new Set([...beforeFields.keys(), ...afterFields.keys()])) {
      const before = beforeFields.get(key)?.value;
      const after = afterFields.get(key)?.value;
      if (same(before, after)) continue;
      if (Array.isArray(before) || Array.isArray(after)) continue;
      changes.push({
        id: `field:${objectId}:${key}`,
        label: `${afterObject?.name ?? beforeObject?.name ?? objectId} · ${afterFields.get(key)?.label ?? beforeFields.get(key)?.label ?? humanizeKey(key)}`,
        before: before as PageScalar | undefined,
        after: after as PageScalar | undefined,
      });
    }
  }
  return changes;
}

function recordChanges(
  prefix: string,
  baseline: Record<string, PageScalar | readonly string[]>,
  current: Record<string, PageScalar | readonly string[]>,
  label: (key: string) => string,
): ReturnedUrlChange[] {
  const changes: ReturnedUrlChange[] = [];
  for (const key of new Set([...Object.keys(baseline), ...Object.keys(current)])) {
    if (same(baseline[key], current[key])) continue;
    changes.push({ id: `${prefix}:${key}`, label: label(key), before: baseline[key], after: current[key] });
  }
  return changes;
}

export function compareJuanPages(baseline: JuanPageDocument, current: JuanPageDocument): ReturnedUrlChange[] {
  const scopeLabels = new Map((current.scopes ?? baseline.scopes ?? []).map((scope) => [scope.id, scope.label]));
  const selectionLabels = new Map<string, string>();
  for (const affordance of current.affordances ?? baseline.affordances ?? []) {
    if (affordance.effect.kind === "select") selectionLabels.set(affordance.effect.selection, affordance.label);
  }
  return [
    ...fieldChanges(baseline, current),
    ...recordChanges("scope", effectiveScopes(baseline), effectiveScopes(current), (key) => scopeLabels.get(key) ?? humanizeKey(key)),
    ...recordChanges(
      "selection",
      baseline.state?.selections ?? {},
      current.state?.selections ?? {},
      (key) => selectionLabels.get(key) ?? humanizeKey(key),
    ),
  ];
}

function activityLabel(page: JuanPageDocument, label: string): string {
  const marker = " · ";
  const separator = label.indexOf(marker);
  if (separator < 0) return label;
  const effect = label.slice(0, separator);
  const id = label.slice(separator + marker.length);
  return page.affordances?.find((affordance) => affordance.id === id)?.label ?? effect;
}

function groupedActivity(page: JuanPageDocument, labels: readonly string[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const raw of labels) {
    const label = activityLabel(page, raw);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([label, count]) => ({ label, count }));
}

function hashFromInput(input: string): string {
  try { return new URL(input).hash || input; }
  catch { return input; }
}

export async function inspectReturnedUrl(input: string, baseline?: JuanPageDocument): Promise<ReturnedUrlInspection> {
  const fragment = parseFragment(hashFromInput(input));
  if (!fragment.data) throw new Error("No JuanPage data payload was found.");
  if (fragment.version && fragment.version !== "5") throw new Error(`Unsupported fragment version v=${fragment.version}; expected v=5.`);
  const decoded = await decodePagePayload(fragment.data, fragment.encoding as PagePayloadEncoding | undefined);
  const ledger = decoded.kind === "m1-session"
    ? interactionLedgerFromMeaningSession(decoded.session)
    : interactionLedgerFromPage(decoded.page);
  const warnings: string[] = [];
  if (!baseline && decoded.kind !== "m1-session" && ledger.some((entry) => entry.patches > 0)) {
    warnings.push("Exact before/after values require the original JuanPage because this direct URL uses the summary interaction ledger.");
  }
  return {
    version: 1,
    kind: decoded.kind,
    title: decoded.page.title,
    interactionCount: ledger.length,
    activity: groupedActivity(decoded.page, ledger.map((entry) => entry.label)),
    changes: baseline ? compareJuanPages(baseline, decoded.page) : [],
    warnings,
  };
}

function text(value: unknown): string {
  if (value === undefined) return "unset";
  if (value === null) return "none";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "none";
  return String(value);
}

export function formatReturnedUrlInspection(report: ReturnedUrlInspection): string {
  const lines = [
    `JuanPage v5 · ${report.kind} · ${report.interactionCount} interaction${report.interactionCount === 1 ? "" : "s"}`,
    "",
    "Final changes",
  ];
  if (report.changes.length) for (const change of report.changes) lines.push(`- ${change.label}: ${text(change.before)} → ${text(change.after)}`);
  else lines.push("- No exact final changes available.");
  lines.push("", "Activity");
  if (report.activity.length) for (const item of report.activity) lines.push(`- ${item.label}: ${item.count}`);
  else lines.push("- No recorded human activity.");
  if (report.warnings.length) {
    lines.push("", "Warnings");
    for (const warning of report.warnings) lines.push(`- ${warning}`);
  }
  return lines.join("\n");
}
