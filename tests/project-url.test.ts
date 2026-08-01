import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CANONICAL_HOST = "https://cakerepository.github.io/JuanPage/";
const LEGACY_HOST = "https://cakerepository.github.io/juanpager/";
const CANONICAL_REPOSITORY = "CakeRepository/JuanPage";
const LEGACY_REPOSITORY = "CakeRepository/juanpager";

const activeProjectFiles = [
  "README.md",
  "CONTRIBUTING.md",
  "docs/AGENT_GUIDE.md",
  "docs/URL_SESSIONS.md",
  "public/config.js",
  "skills/juanpage/SKILL.md",
  "skills/juanpage/scripts/evolve.py",
  "skills/juanpage/references/repository-snapshot.json",
  "src/encoding/fragment.ts",
  "src/examples/skill-first-run.ts",
  "src/examples/juanpage-studio.ts",
  "tests/skill-first-run.test.ts",
  "tests/juanpage-studio.test.ts",
] as const;

function readProjectFile(path: string): string {
  return readFileSync(path, "utf8");
}

describe("canonical JuanPage project location", () => {
  it("contains no active references to the former repository or Pages host", () => {
    for (const path of activeProjectFiles) {
      const content = readProjectFile(path);
      expect(content, path).not.toContain(LEGACY_HOST);
      expect(content, path).not.toContain(LEGACY_REPOSITORY);
    }
  });

  it("keeps the installable skill and generated examples on the production host", () => {
    for (const path of [
      "skills/juanpage/SKILL.md",
      "docs/AGENT_GUIDE.md",
      "docs/URL_SESSIONS.md",
      "src/examples/skill-first-run.ts",
      "src/examples/juanpage-studio.ts",
    ]) {
      expect(readProjectFile(path), path).toContain(CANONICAL_HOST);
    }
  });

  it("keeps active repository tooling on the renamed repository identity", () => {
    for (const path of [
      "README.md",
      "CONTRIBUTING.md",
      "public/config.js",
      "src/encoding/fragment.ts",
      "skills/juanpage/SKILL.md",
      "skills/juanpage/scripts/evolve.py",
      "skills/juanpage/references/repository-snapshot.json",
    ]) {
      expect(readProjectFile(path), path).toContain(CANONICAL_REPOSITORY);
    }
  });
});
