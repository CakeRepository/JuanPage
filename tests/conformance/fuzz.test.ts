import { describe, expect, it } from "vitest";
import { futureWorkspace } from "../../src/examples/future-workspace.js";
import { operationsControlRoomPacket } from "../../src/examples/operations-control-room.js";
import { validateMeaningPacket } from "../../src/protocol/meaning.js";
import { validatePage } from "../../src/schema/page.js";

function generator(initial: number): () => number {
  let state = initial >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function randomJson(next: () => number, depth = 0): unknown {
  const choice = Math.floor(next() * (depth >= 4 ? 5 : 8));
  if (choice === 0) return null;
  if (choice === 1) return next() > 0.5;
  if (choice === 2) return Math.floor(next() * 20_000) - 10_000;
  if (choice === 3) return `value:${Math.floor(next() * 1_000_000)}`;
  if (choice === 4) return next() > 0.9 ? Number.NaN : next() * 100;
  if (choice === 5) return Array.from({ length: Math.floor(next() * 8) }, () => randomJson(next, depth + 1));
  const record: Record<string, unknown> = {};
  for (let index = 0; index < Math.floor(next() * 8); index += 1) {
    record[`key:${Math.floor(next() * 20)}`] = randomJson(next, depth + 1);
  }
  return record;
}

function expectSafeRejection(operation: () => unknown): void {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
  }
}

function rejectionDetails(operation: () => unknown): string {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    if (typeof error === "object" && error !== null && "details" in error) {
      return String((error as { details: unknown }).details);
    }
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("Expected hostile input to be rejected.");
}

describe("deterministic hostile-input conformance", () => {
  it("never crashes outside the documented error boundary for generated JSON values", () => {
    const next = generator(0x4a55414e);
    for (let index = 0; index < 750; index += 1) {
      const value = randomJson(next);
      expectSafeRejection(() => validatePage(value));
      expectSafeRejection(() => validateMeaningPacket(value));
    }
  });

  it("rejects authority, reference, URL, and opcode confusion", () => {
    const unknownAffordance = structuredClone(futureWorkspace) as unknown as {
      bindings: Array<{ affordance: string }>;
    };
    unknownAffordance.bindings[0]!.affordance = "missing-affordance";
    expect(rejectionDetails(() => validatePage(unknownAffordance))).toMatch(/unknown affordance/iu);

    const unsafeNavigation = structuredClone(futureWorkspace) as unknown as {
      affordances: Array<{ effect: Record<string, unknown> }>;
    };
    unsafeNavigation.affordances[0]!.effect = { kind: "navigate", url: "javascript:alert(1)" };
    expect(rejectionDetails(() => validatePage(unsafeNavigation))).toMatch(/url|https|invalid/iu);

    const unknownOpcode = structuredClone(operationsControlRoomPacket) as unknown as unknown[];
    (unknownOpcode[5] as unknown[][]).push([999, "authority:confusion"]);
    expect(rejectionDetails(() => validateMeaningPacket(unknownOpcode))).toMatch(/opcode/iu);

    const unknownEntity = structuredClone(operationsControlRoomPacket) as unknown as unknown[];
    (unknownEntity[5] as unknown[][]).push([2, "missing:entity", "prop:test", true, null, 0, 0, null]);
    expect(rejectionDetails(() => validateMeaningPacket(unknownEntity))).toMatch(/unknown entity/iu);
  });

  it("remains deterministic after fuzzing attempts", () => {
    expect(validatePage(structuredClone(futureWorkspace))).toEqual(validatePage(structuredClone(futureWorkspace)));
    expect(validateMeaningPacket(structuredClone(operationsControlRoomPacket))).toEqual(validateMeaningPacket(structuredClone(operationsControlRoomPacket)));
  });
});
