import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { NonceStore } from "./envelope.js";

type StoredNonceFile = Readonly<{
  version: 1;
  entries: Readonly<Record<string, number>>;
}>;

export type FileNonceStoreOptions = Readonly<{
  path: string;
  lockTimeoutMs?: number;
  retryDelayMs?: number;
  staleLockMs?: number;
  now?: () => Date;
}>;

const sleep = (milliseconds: number): Promise<void> => new Promise((resolvePromise) => {
  setTimeout(resolvePromise, milliseconds);
});

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function nonceKey(issuer: string, nonce: string): string {
  return createHash("sha256").update(issuer).update("\u0000").update(nonce).digest("base64url");
}

/**
 * Durable replay protection for a single host or a shared filesystem.
 *
 * A lock directory serializes readers and writers across processes. The data
 * file is replaced atomically after expired entries are pruned. Deployments
 * that need multi-region consensus should implement NonceStore against their
 * transactional database instead.
 */
export class FileNonceStore implements NonceStore {
  private readonly path: string;
  private readonly lockPath: string;
  private readonly lockTimeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly staleLockMs: number;
  private readonly now: () => Date;

  constructor(options: FileNonceStoreOptions) {
    this.path = resolve(options.path);
    this.lockPath = `${this.path}.lock`;
    this.lockTimeoutMs = options.lockTimeoutMs ?? 5_000;
    this.retryDelayMs = options.retryDelayMs ?? 20;
    this.staleLockMs = options.staleLockMs ?? 30_000;
    this.now = options.now ?? (() => new Date());
  }

  async consume(issuer: string, nonce: string, expiresAt: Date): Promise<boolean> {
    const expiration = expiresAt.getTime();
    const now = this.now().getTime();
    if (!Number.isFinite(expiration) || expiration <= now) return false;

    await mkdir(dirname(this.path), { recursive: true });
    await this.acquireLock();
    try {
      const stored = await this.readState();
      const entries: Record<string, number> = {};
      for (const [key, value] of Object.entries(stored.entries)) {
        if (Number.isFinite(value) && value > now) entries[key] = value;
      }

      const key = nonceKey(issuer, nonce);
      if (entries[key] !== undefined) {
        await this.writeState({ version: 1, entries });
        return false;
      }

      entries[key] = expiration;
      await this.writeState({ version: 1, entries });
      return true;
    } finally {
      await rm(this.lockPath, { recursive: true, force: true });
    }
  }

  private async acquireLock(): Promise<void> {
    const started = Date.now();
    while (Date.now() - started <= this.lockTimeoutMs) {
      try {
        await mkdir(this.lockPath);
        return;
      } catch (error) {
        if (errorCode(error) !== "EEXIST") throw error;
        try {
          const lock = await stat(this.lockPath);
          if (Date.now() - lock.mtimeMs > this.staleLockMs) {
            await rm(this.lockPath, { recursive: true, force: true });
            continue;
          }
        } catch (statError) {
          if (errorCode(statError) !== "ENOENT") throw statError;
          continue;
        }
        await sleep(this.retryDelayMs);
      }
    }
    throw new Error(`Timed out acquiring nonce-store lock for ${this.path}.`);
  }

  private async readState(): Promise<StoredNonceFile> {
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as unknown;
      if (
        typeof parsed !== "object" || parsed === null ||
        (parsed as { version?: unknown }).version !== 1 ||
        typeof (parsed as { entries?: unknown }).entries !== "object" ||
        (parsed as { entries?: unknown }).entries === null ||
        Array.isArray((parsed as { entries?: unknown }).entries)
      ) {
        throw new Error("Nonce-store data is malformed.");
      }
      return parsed as StoredNonceFile;
    } catch (error) {
      if (errorCode(error) === "ENOENT") return { version: 1, entries: {} };
      throw error;
    }
  }

  private async writeState(state: StoredNonceFile): Promise<void> {
    const temporary = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(state)}\n`, { encoding: "utf8", mode: 0o600 });
      await rename(temporary, this.path);
    } finally {
      await rm(temporary, { force: true });
    }
  }
}
