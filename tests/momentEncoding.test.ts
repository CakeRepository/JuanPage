import { describe, expect, it } from "vitest";
import { bytesToBase64Url } from "../src/encoding/base64url";
import {
  MOMENT_FIELD_TO_SHORT,
  fromCompactMoment,
  toCompactMoment,
} from "../src/encoding/compactMoment";
import { parseFragment } from "../src/encoding/fragment";
import {
  decodeMoment,
  decodePayload,
  encodeMoment,
  encodeMomentToFragment,
  encodeToFragment,
} from "../src/encoding/pipeline";
import { groceryCheckout } from "../src/examples/grocery-checkout";
import { groceryPlan } from "../src/examples/grocery-plan";
import { validateMoment } from "../src/schema/moment";

describe("moment encoding", () => {
  it("compacts and expands moments losslessly", () => {
    const compact = toCompactMoment(groceryCheckout);
    expect(compact[MOMENT_FIELD_TO_SHORT.title!]).toBe(groceryCheckout.title);
    expect(compact.mo).toBe("cf");
    expect(Array.isArray(compact.en)).toBe(true);

    const expanded = validateMoment(fromCompactMoment(compact));
    expect(expanded).toEqual(groceryCheckout);
  });

  it("expands readable JSON through the same path", () => {
    const expanded = validateMoment(
      fromCompactMoment(JSON.parse(JSON.stringify(groceryCheckout))),
    );
    expect(expanded).toEqual(groceryCheckout);
  });

  it("keeps compact keys free of collisions with readable field names", () => {
    for (const [long, short] of Object.entries(MOMENT_FIELD_TO_SHORT)) {
      if (long === short) continue;
      expect(MOMENT_FIELD_TO_SHORT[short]).toBeUndefined();
    }
  });

  it("round-trips gzip payloads", async () => {
    const payload = await encodeMoment(groceryCheckout, "gz");
    const decoded = await decodeMoment(payload, "gz");
    expect(decoded).toEqual(groceryCheckout);
  });

  it("round-trips raw payloads", async () => {
    const payload = await encodeMoment(groceryCheckout, "raw");
    const decoded = await decodeMoment(payload, "raw");
    expect(decoded).toEqual(groceryCheckout);

    // raw payloads are plain JSON, so they are readable without decompressing
    const json = Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    expect(JSON.parse(json).version).toBe("0.2");
  });

  it("keeps gzip links smaller than raw links", async () => {
    const gz = await encodeMoment(groceryCheckout, "gz");
    const raw = await encodeMoment(groceryCheckout, "raw");
    expect(gz.length).toBeLessThan(raw.length);
  });

  it("builds versioned fragments and decodes them via the unified loader", async () => {
    const gzFragment = await encodeMomentToFragment(groceryCheckout, "gz");
    expect(gzFragment.startsWith("#v=2&enc=gz&data=")).toBe(true);

    const rawFragment = await encodeMomentToFragment(groceryCheckout, "raw");
    expect(rawFragment.startsWith("#v=2&enc=raw&data=")).toBe(true);

    for (const fragment of [gzFragment, rawFragment]) {
      const { data, version, encoding } = parseFragment(fragment);
      expect(version).toBe("2");
      const loaded = await decodePayload(data!, { version, encoding });
      expect(loaded.kind).toBe("moment");
      expect(loaded.document.title).toBe(groceryCheckout.title);
    }
  });

  it("still decodes 0.1 documents through the unified loader", async () => {
    const fragment = await encodeToFragment(groceryPlan);
    expect(fragment.startsWith("#v=1&data=")).toBe(true);
    const { data, version } = parseFragment(fragment);
    const loaded = await decodePayload(data!, { version });
    expect(loaded.kind).toBe("components");
    expect(loaded.document.title).toBe(groceryPlan.title);
  });

  it("decodes without an explicit encoding hint", async () => {
    for (const encoding of ["gz", "raw"] as const) {
      const payload = await encodeMoment(groceryCheckout, encoding);
      const loaded = await decodePayload(payload);
      expect(loaded.kind).toBe("moment");
    }
  });

  it("explains truncated or corrupted payloads", async () => {
    const payload = await encodeMoment(groceryCheckout, "gz");
    const truncated = payload.slice(0, Math.floor(payload.length / 2));
    await expect(decodeMoment(truncated, "gz")).rejects.toThrow(
      /truncated or corrupted/i,
    );

    await expect(
      decodeMoment(bytesToBase64Url(new Uint8Array([1, 2, 3])), "gz"),
    ).rejects.toThrow(/truncated or corrupted/i);
  });

  it("rejects moments that fail validation after decoding", async () => {
    const payload = bytesToBase64Url(
      new TextEncoder().encode(JSON.stringify({ version: "0.2", title: "x" })),
    );
    await expect(decodeMoment(payload, "raw")).rejects.toThrow(/invalid/i);
  });
});
