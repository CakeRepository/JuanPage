#!/usr/bin/env python3
"""Maintain the repository-local JuanPage Agent with reviewable evidence."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_DIR = SCRIPT_DIR.parent
DEFAULT_MANIFEST = SKILL_DIR / "references" / "source-manifest.json"
DEFAULT_SNAPSHOT = SKILL_DIR / "references" / "repository-snapshot.json"
DEFAULT_LESSONS = SKILL_DIR / "references" / "learned-patterns.md"
DEFAULT_CANDIDATES = SKILL_DIR / "evolution" / "candidates"


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SystemExit(f"Missing required file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON in {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise SystemExit(f"Expected a JSON object in {path}")
    return value


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def git_blob_sha(data: bytes) -> str:
    header = f"blob {len(data)}\0".encode("ascii")
    return hashlib.sha1(header + data).hexdigest()  # Git identity, not a security signature.


def manifest_paths(manifest_path: Path) -> list[str]:
    manifest = read_json(manifest_path)
    sources = manifest.get("sources")
    if not isinstance(sources, list) or not sources or not all(isinstance(item, str) and item for item in sources):
        raise SystemExit(f"{manifest_path} must contain a non-empty string array named 'sources'")
    if len(set(sources)) != len(sources):
        raise SystemExit(f"{manifest_path} contains duplicate source paths")
    return sources


def repository_commit(repo: Path) -> str:
    try:
        result = subprocess.run(
            ["git", "-C", str(repo), "rev-parse", "HEAD"],
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def current_snapshot(repo: Path, manifest_path: Path) -> dict[str, Any]:
    repo = repo.resolve()
    paths = manifest_paths(manifest_path)
    files: dict[str, str] = {}
    missing: list[str] = []
    for relative in paths:
        path = repo / relative
        if not path.is_file():
            missing.append(relative)
            continue
        files[relative] = git_blob_sha(path.read_bytes())
    if missing:
        raise SystemExit("Canonical source files are missing:\n- " + "\n- ".join(missing))
    return {
        "version": 1,
        "repository": "CakeRepository/juanpager",
        "commit": repository_commit(repo),
        "generated_at": utc_now(),
        "manifest_digest": hashlib.sha256("\n".join(paths).encode("utf-8")).hexdigest(),
        "files": files,
    }


def command_sync(args: argparse.Namespace) -> int:
    snapshot = current_snapshot(args.repo, args.manifest)
    write_json(args.snapshot, snapshot)
    print(f"Updated {args.snapshot} for {len(snapshot['files'])} canonical files.")
    return 0


def command_check(args: argparse.Namespace) -> int:
    expected = read_json(args.snapshot)
    actual = current_snapshot(args.repo, args.manifest)
    expected_files = expected.get("files")
    if not isinstance(expected_files, dict):
        raise SystemExit(f"{args.snapshot} must contain a 'files' object")
    changed = sorted(
        path for path in set(expected_files) | set(actual["files"])
        if expected_files.get(path) != actual["files"].get(path)
    )
    if changed:
        print("JuanPage Agent canonical-source drift detected:", file=sys.stderr)
        for path in changed:
            print(f"- {path}", file=sys.stderr)
        print("Inspect the changes, update guidance when needed, then run evolve.py sync --repo .", file=sys.stderr)
        return 1
    print(f"JuanPage Agent snapshot matches {len(actual['files'])} canonical files.")
    return 0


def slug(value: str) -> str:
    return (re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:60] or "lesson")


def snapshot_digest(snapshot: dict[str, Any]) -> str:
    files = snapshot.get("files")
    if not isinstance(files, dict):
        raise SystemExit("Snapshot does not contain a valid files object")
    canonical = json.dumps(files, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def normalize_evidence(repo: Path, values: list[str]) -> list[str]:
    normalized: list[str] = []
    for value in values:
        candidate = Path(value)
        path = candidate if candidate.is_absolute() else repo / candidate
        try:
            relative = path.resolve().relative_to(repo.resolve())
        except ValueError as exc:
            raise SystemExit(f"Evidence must be inside the repository: {value}") from exc
        if not path.is_file():
            raise SystemExit(f"Evidence file does not exist: {relative.as_posix()}")
        normalized.append(relative.as_posix())
    return sorted(set(normalized))


def evidence_blobs(repo: Path, evidence: list[str]) -> dict[str, str]:
    return {path: git_blob_sha((repo / path).read_bytes()) for path in evidence}


def next_candidate_path(output_dir: Path, identifier: str) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / f"{identifier}.json"
    index = 2
    while path.exists():
        path = output_dir / f"{identifier}-{index}.json"
        index += 1
    return path


def command_propose(args: argparse.Namespace) -> int:
    repo = args.repo.resolve()
    title = args.title.strip()
    lesson = args.lesson.strip()
    if len(title) < 8:
        raise SystemExit("Candidate title must be at least 8 characters")
    if len(lesson) < 20:
        raise SystemExit("Candidate lesson must be at least 20 characters")
    evidence = normalize_evidence(repo, args.evidence)
    snapshot = current_snapshot(repo, args.manifest)
    identifier = f"{dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{slug(title)}"
    path = next_candidate_path(args.output_dir, identifier)
    write_json(path, {
        "version": 2,
        "id": path.stem,
        "title": title,
        "lesson": lesson,
        "evidence": evidence,
        "evidence_blobs": evidence_blobs(repo, evidence),
        "repository": snapshot["repository"],
        "repository_commit": snapshot["commit"],
        "snapshot_digest": snapshot_digest(snapshot),
        "created_at": utc_now(),
        "status": "proposed",
    })
    print(path)
    return 0


def verify_candidate_integrity(
    repo: Path,
    candidate: dict[str, Any],
    manifest: Path,
    evidence: list[str],
) -> None:
    snapshot = current_snapshot(repo, manifest)
    if candidate.get("repository") != snapshot["repository"]:
        raise SystemExit("Candidate repository does not match this JuanPager repository; re-propose it here")
    expected_snapshot = candidate.get("snapshot_digest")
    if not isinstance(expected_snapshot, str) or expected_snapshot != snapshot_digest(snapshot):
        raise SystemExit("Canonical source changed after this candidate was proposed; inspect the drift and re-propose the lesson")
    expected_blobs = candidate.get("evidence_blobs")
    if not isinstance(expected_blobs, dict) or set(expected_blobs) != set(evidence):
        raise SystemExit("Candidate lacks complete evidence digests; re-propose it with the current evolution tool")
    current_blobs = evidence_blobs(repo, evidence)
    changed = sorted(path for path in evidence if expected_blobs.get(path) != current_blobs[path])
    if changed:
        raise SystemExit("Candidate evidence changed after proposal:\n- " + "\n- ".join(changed) + "\nRe-review and re-propose the lesson")


def command_promote(args: argparse.Namespace) -> int:
    repo = args.repo.resolve()
    candidate = read_json(args.candidate)
    if candidate.get("status") != "proposed":
        raise SystemExit("Only proposed candidates can be promoted")
    approved_by = args.approved_by.strip()
    if not approved_by:
        raise SystemExit("--approved-by must identify the reviewer or reviewing agent")
    title = candidate.get("title")
    lesson = candidate.get("lesson")
    evidence = candidate.get("evidence")
    if not isinstance(title, str) or not isinstance(lesson, str) or not isinstance(evidence, list):
        raise SystemExit("Candidate is missing title, lesson, or evidence")
    normalized = normalize_evidence(repo, [str(item) for item in evidence])
    verify_candidate_integrity(repo, candidate, args.manifest, normalized)
    lessons_text = args.lessons.read_text(encoding="utf-8") if args.lessons.exists() else "# Promoted JuanPage patterns\n"
    fingerprint = hashlib.sha256(lesson.strip().lower().encode("utf-8")).hexdigest()[:16]
    marker = f"lesson:{fingerprint}"
    if marker in lessons_text or lesson.strip().lower() in lessons_text.lower():
        raise SystemExit("This lesson already appears to be promoted")
    block = (
        f"\n## {title}\n\n{lesson.strip()}\n\n"
        f"Evidence: {', '.join(f'`{path}`' for path in normalized)}.\n\n"
        f"Promotion: `{marker}` approved by `{approved_by}` on `{utc_now()}`.\n"
    )
    args.lessons.parent.mkdir(parents=True, exist_ok=True)
    args.lessons.write_text(lessons_text.rstrip() + "\n" + block, encoding="utf-8")
    candidate["status"] = "promoted"
    candidate["approved_by"] = approved_by
    candidate["promoted_at"] = utc_now()
    candidate["lesson_fingerprint"] = marker
    write_json(args.candidate, candidate)
    print(f"Promoted {candidate.get('id', args.candidate.stem)} into {args.lessons}")
    return 0


def path_arg(value: str) -> Path:
    return Path(value).expanduser()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    def shared(subparser: argparse.ArgumentParser) -> None:
        subparser.add_argument("--repo", type=path_arg, default=Path.cwd(), help="JuanPager repository root")
        subparser.add_argument("--manifest", type=path_arg, default=DEFAULT_MANIFEST)

    check = subparsers.add_parser("check", help="Fail when canonical sources drift from the skill snapshot")
    shared(check)
    check.add_argument("--snapshot", type=path_arg, default=DEFAULT_SNAPSHOT)
    check.set_defaults(func=command_check)

    sync = subparsers.add_parser("sync", help="Refresh the canonical-source snapshot after review")
    shared(sync)
    sync.add_argument("--snapshot", type=path_arg, default=DEFAULT_SNAPSHOT)
    sync.set_defaults(func=command_sync)

    propose = subparsers.add_parser("propose", help="Record an evidence-backed lesson candidate")
    shared(propose)
    propose.add_argument("--title", required=True)
    propose.add_argument("--lesson", required=True)
    propose.add_argument("--evidence", action="append", required=True, help="Repository-relative evidence file; repeatable")
    propose.add_argument("--output-dir", type=path_arg, default=DEFAULT_CANDIDATES)
    propose.set_defaults(func=command_propose)

    promote = subparsers.add_parser("promote", help="Promote an approved candidate into the lesson ledger")
    shared(promote)
    promote.add_argument("--candidate", type=path_arg, required=True)
    promote.add_argument("--approved-by", required=True)
    promote.add_argument("--lessons", type=path_arg, default=DEFAULT_LESSONS)
    promote.set_defaults(func=command_promote)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
