#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import gzip
import json
from collections import Counter
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ACTIVITY_ID = "juanpager:activity"
LEDGER_KEY = "juanpager.interactionLedger"


def _decode(url: str) -> dict:
    fragment = urlparse(url).fragment if "#" in url else url.lstrip("#")
    params = parse_qs(fragment, keep_blank_values=True)
    version = params.get("v", [None])[0]
    if version not in (None, "5"):
        raise ValueError(f"Unsupported fragment version v={version}; expected v=5.")
    data = params.get("data", [fragment if "=" not in fragment else None])[0]
    if not data:
        raise ValueError("No JuanPage data payload was found.")
    raw = base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))
    if params.get("enc", [None])[0] == "gz" or raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    value = json.loads(raw)
    if isinstance(value, dict) and value.get("transport") == "m1-session":
        return {"kind": "m1-session", "value": value}
    if isinstance(value, dict) and value.get("transport") == "m1":
        return {"kind": "m1", "value": value}
    return {"kind": "juanpage", "value": value}


def _objects(page: dict) -> dict[str, dict]:
    return {item["id"]: item for item in page.get("objects", []) if item.get("id") != ACTIVITY_ID}


def _scopes(page: dict) -> dict:
    result = {scope["id"]: scope.get("initial") for scope in page.get("scopes", []) if "initial" in scope}
    result.update(page.get("state", {}).get("scopes", {}))
    return result


def _changes(before: dict, after: dict) -> list[dict]:
    changes: list[dict] = []
    before_objects, after_objects = _objects(before), _objects(after)
    for object_id in sorted(set(before_objects) | set(after_objects)):
        old, new = before_objects.get(object_id, {}), after_objects.get(object_id, {})
        old_fields = {field["key"]: field for field in old.get("fields", [])}
        new_fields = {field["key"]: field for field in new.get("fields", [])}
        for key in sorted(set(old_fields) | set(new_fields)):
            old_value = old_fields.get(key, {}).get("value")
            new_value = new_fields.get(key, {}).get("value")
            if old_value == new_value:
                continue
            label = new_fields.get(key, old_fields.get(key, {})).get("label", key)
            changes.append({"label": f"{new.get('name', old.get('name', object_id))} · {label}", "before": old_value, "after": new_value})
    labels = {scope["id"]: scope.get("label", scope["id"]) for scope in after.get("scopes", before.get("scopes", []))}
    old_scopes, new_scopes = _scopes(before), _scopes(after)
    for key in sorted(set(old_scopes) | set(new_scopes)):
        if old_scopes.get(key) != new_scopes.get(key):
            changes.append({"label": labels.get(key, key), "before": old_scopes.get(key), "after": new_scopes.get(key)})
    return changes


def inspect_url(url: str, baseline: dict | None = None) -> dict:
    decoded = _decode(url)
    if decoded["kind"] != "juanpage":
        value = decoded["value"]
        return {"kind": decoded["kind"], "interactionCount": len(value.get("deltas", [])), "changes": [], "activity": [], "warnings": []}
    page = decoded["value"]
    encoded = page.get("metadata", {}).get(LEDGER_KEY, "[]")
    try:
        ledger = json.loads(encoded) if isinstance(encoded, str) else []
    except json.JSONDecodeError:
        ledger = []
    affordances = {item["id"]: item.get("label", item["id"]) for item in page.get("affordances", [])}
    labels = []
    for entry in ledger:
        label = entry.get("label", "Interaction")
        if " · " in label:
            effect, affordance_id = label.split(" · ", 1)
            label = affordances.get(affordance_id, effect)
        labels.append(label)
    warnings = []
    if baseline is None and any(entry.get("patches", 0) for entry in ledger):
        warnings.append("Exact before/after values require the original JuanPage because this direct URL uses the summary interaction ledger.")
    return {
        "kind": "juanpage",
        "title": page.get("title", "JuanPage"),
        "interactionCount": len(ledger),
        "changes": _changes(baseline, page) if baseline else [],
        "activity": [{"label": label, "count": count} for label, count in Counter(labels).items()],
        "warnings": warnings,
    }


def _text(value: object) -> str:
    if value is None:
        return "none"
    if isinstance(value, list):
        return ", ".join(map(str, value)) or "none"
    return str(value)


def format_report(report: dict) -> str:
    lines = [f"JuanPage v5 · {report['kind']} · {report['interactionCount']} interactions", "", "Final changes"]
    lines.extend(f"- {item['label']}: {_text(item.get('before'))} → {_text(item.get('after'))}" for item in report["changes"])
    if not report["changes"]:
        lines.append("- No exact final changes available.")
    lines.extend(["", "Activity"])
    lines.extend(f"- {item['label']}: {item['count']}" for item in report["activity"])
    if not report["activity"]:
        lines.append("- No recorded human activity.")
    if report["warnings"]:
        lines.extend(["", "Warnings", *(f"- {item}" for item in report["warnings"])])
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect a returned JuanPage URL.")
    parser.add_argument("url")
    parser.add_argument("--against", type=Path)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    baseline = json.loads(args.against.read_text(encoding="utf-8")) if args.against else None
    report = inspect_url(args.url, baseline)
    print(json.dumps(report, indent=2) if args.json else format_report(report))


if __name__ == "__main__":
    main()
