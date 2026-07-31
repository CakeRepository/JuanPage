import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileNonceStore } from "../src/protocol/file-nonce-store.js";

const temporaryDirectories: string[] = [];

async function temporaryPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "juanpager-nonce-"));
  temporaryDirectories.push(directory);
  return join(directory, "nonces.json");
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("FileNonceStore", () => {
  it("accepts a nonce exactly once across concurrent store instances", async () => {
    const path = await temporaryPath();
    const expiresAt = new Date("2026-08-01T00:00:00.000Z");
    const now = () => new Date("2026-07-31T23:00:00.000Z");
    const first = new FileNonceStore({ path, now });
    const second = new FileNonceStore({ path, now });

    const results = await Promise.all([
      first.consume("issuer:test", "nonce:one", expiresAt),
      second.consume("issuer:test", "nonce:one", expiresAt),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    await expect(new FileNonceStore({ path, now }).consume("issuer:test", "nonce:one", expiresAt)).resolves.toBe(false);
    const persisted = JSON.parse(await readFile(path, "utf8")) as { version: number; entries: Record<string, number> };
    expect(persisted.version).toBe(1);
    expect(Object.keys(persisted.entries)).toHaveLength(1);
  });

  it("prunes expired entries and allows nonce reuse only after expiration", async () => {
    const path = await temporaryPath();
    let clock = new Date("2026-07-31T23:00:00.000Z");
    const store = new FileNonceStore({ path, now: () => clock });
    const expiresAt = new Date(clock.getTime() + 1_000);

    await expect(store.consume("issuer:test", "nonce:expiring", expiresAt)).resolves.toBe(true);
    clock = new Date(clock.getTime() + 2_000);
    await expect(store.consume("issuer:test", "nonce:expiring", new Date(clock.getTime() + 1_000))).resolves.toBe(true);
  });

  it("fails closed when persisted replay state is corrupt", async () => {
    const path = await temporaryPath();
    await writeFile(path, "not-json", "utf8");
    const store = new FileNonceStore({ path, now: () => new Date("2026-07-31T23:00:00.000Z") });
    await expect(store.consume("issuer:test", "nonce:bad", new Date("2026-08-01T00:00:00.000Z"))).rejects.toBeInstanceOf(Error);
  });
});
