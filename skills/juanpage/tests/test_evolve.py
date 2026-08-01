#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT_SOURCE = Path(__file__).resolve().parents[1] / "scripts" / "evolve.py"


class EvolveCliTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.repo = Path(self.temp.name)
        self.skill = self.repo / "skills" / "juanpage"
        self.script = self.skill / "scripts" / "evolve.py"
        self.references = self.skill / "references"
        self.manifest = self.references / "source-manifest.json"
        self.snapshot = self.references / "repository-snapshot.json"
        self.lessons = self.references / "learned-patterns.md"
        self.candidates = self.skill / "evolution" / "candidates"
        self.script.parent.mkdir(parents=True)
        self.references.mkdir(parents=True)
        (self.repo / "src" / "schema").mkdir(parents=True)
        (self.repo / "tests").mkdir(parents=True)
        shutil.copy2(SCRIPT_SOURCE, self.script)
        self.manifest.write_text(json.dumps({"version": 1, "sources": ["src/schema/page.ts"]}), encoding="utf-8")
        (self.repo / "src" / "schema" / "page.ts").write_text('export const version = "2.0";\n', encoding="utf-8")
        (self.repo / "tests" / "evidence.txt").write_text("validated example\n", encoding="utf-8")
        self.lessons.write_text("# Promoted JuanPage patterns\n", encoding="utf-8")
        subprocess.run(["git", "-C", str(self.repo), "init", "-q"], check=True)
        subprocess.run(["git", "-C", str(self.repo), "config", "user.name", "Evolve Test"], check=True)
        subprocess.run(["git", "-C", str(self.repo), "config", "user.email", "evolve@example.test"], check=True)
        subprocess.run(["git", "-C", str(self.repo), "add", "."], check=True)
        subprocess.run(["git", "-C", str(self.repo), "commit", "-qm", "fixture"], check=True)
        self.run_cli("sync")

    def tearDown(self) -> None:
        self.temp.cleanup()

    def run_cli(self, command: str, *args: str, check: bool = True, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                sys.executable,
                str(self.script),
                command,
                "--repo",
                str(self.repo),
                "--manifest",
                str(self.manifest),
                *args,
            ],
            check=check,
            capture_output=True,
            text=True,
            env=env,
        )

    def propose(self, title: str = "Preserve evidence integrity") -> Path:
        result = self.run_cli(
            "propose",
            "--title",
            title,
            "--lesson",
            "Require exact snapshot and evidence digests before promoting a lesson.",
            "--evidence",
            "tests/evidence.txt",
            "--output-dir",
            str(self.candidates),
        )
        return Path(result.stdout.strip())

    def promote(self, candidate: Path, check: bool = True) -> subprocess.CompletedProcess[str]:
        return self.run_cli(
            "promote",
            "--candidate",
            str(candidate),
            "--approved-by",
            "test-reviewer",
            "--lessons",
            str(self.lessons),
            check=check,
        )

    def test_cli_does_not_require_python_alias(self) -> None:
        isolated_bin = self.repo / "isolated-bin"
        isolated_bin.mkdir()
        git = shutil.which("git")
        self.assertIsNotNone(git)
        (isolated_bin / "git").symlink_to(git)
        env = os.environ.copy()
        env["PATH"] = str(isolated_bin)
        result = self.run_cli("check", "--snapshot", str(self.snapshot), env=env)
        self.assertIn("snapshot matches", result.stdout)

    def test_valid_candidate_promotes(self) -> None:
        candidate = self.propose()
        result = self.promote(candidate)
        self.assertIn("Promoted", result.stdout)
        promoted = json.loads(candidate.read_text(encoding="utf-8"))
        self.assertEqual(promoted["status"], "promoted")
        self.assertIn("test-reviewer", self.lessons.read_text(encoding="utf-8"))

    def test_canonical_drift_blocks_promotion(self) -> None:
        candidate = self.propose()
        (self.repo / "src" / "schema" / "page.ts").write_text('export const version = "3.0";\n', encoding="utf-8")
        result = self.promote(candidate, check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Canonical source changed", result.stderr)
        self.assertEqual(json.loads(candidate.read_text(encoding="utf-8"))["status"], "proposed")

    def test_evidence_drift_blocks_promotion(self) -> None:
        candidate = self.propose()
        (self.repo / "tests" / "evidence.txt").write_text("changed after review\n", encoding="utf-8")
        result = self.promote(candidate, check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Candidate evidence changed", result.stderr)
        self.assertEqual(json.loads(candidate.read_text(encoding="utf-8"))["status"], "proposed")

    def test_same_second_candidates_do_not_overwrite(self) -> None:
        first = self.propose("Avoid candidate overwrite")
        second = self.propose("Avoid candidate overwrite")
        self.assertNotEqual(first, second)
        self.assertTrue(first.exists())
        self.assertTrue(second.exists())


if __name__ == "__main__":
    unittest.main()
