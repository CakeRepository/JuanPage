import { describe, expect, it } from "vitest";
import { base64UrlToBytes, bytesToBase64Url } from "../src/encoding/base64url";
import {
  FIELD_TO_SHORT,
  fromCompactDocument,
  toCompactDocument,
} from "../src/encoding/compact";
import { parseFragment } from "../src/encoding/fragment";
import {
  compressDocument,
  decompressDocument,
  encodeDocumentToFragment,
} from "../src/encoding/pipeline";
import { groceryPlan } from "../src/examples/grocery-plan";
import { validateDocument } from "../src/schema/document";

describe("encoding", () => {
  it("maps compact fields explicitly", () => {
    expect(FIELD_TO_SHORT.displayPrice).toBe("dp");
    expect(FIELD_TO_SHORT.quantity).toBe("q");
    const compact = toCompactDocument(groceryPlan);
    expect(compact.ti).toBe(groceryPlan.title);
    expect(Array.isArray(compact.cs)).toBe(true);
    const expanded = fromCompactDocument(compact);
    expect(validateDocument(expanded).title).toBe(groceryPlan.title);
  });

  it("round-trips Base64URL", () => {
    const bytes = new TextEncoder().encode("juanpager");
    const encoded = bytesToBase64Url(bytes);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(new TextDecoder().decode(base64UrlToBytes(encoded))).toBe("juanpager");
  });

  it("round-trips compression and full encode/decode", async () => {
    const payload = await compressDocument(groceryPlan);
    expect(payload.length).toBeGreaterThan(20);
    const decoded = await decompressDocument(payload);
    expect(decoded.title).toBe(groceryPlan.title);
    expect(decoded.components.length).toBe(groceryPlan.components.length);

    const fragment = await encodeDocumentToFragment(groceryPlan);
    const { data } = parseFragment(fragment);
    expect(data).toBeTruthy();
    const again = await decompressDocument(data!);
    expect(again.metadata?.priceNote).toBe("sample");
  });

  it("rejects invalid compressed payloads", async () => {
    await expect(decompressDocument(bytesToBase64Url(new Uint8Array([1, 2, 3])))).rejects.toThrow(
      /truncated or corrupted|Invalid JSON|Base64/i,
    );
  });

  it("rejects invalid JSON after decompress-like failure path", async () => {
    await expect(decompressDocument("@@@not-base64@@@")).rejects.toThrow();
  });

  it("enforces encoded payload size limits", async () => {
    const hugeText = "x".repeat(1900);
    const components = Array.from({ length: 80 }, (_, i) => ({
      type: "text" as const,
      // High-entropy unique strings resist gzip enough to exceed the encoded cap.
      text: `${hugeText}${i.toString(36)}${Math.random().toString(36).slice(2)}${"y".repeat(50)}`,
    }));
    await expect(
      compressDocument({
        version: "0.1",
        title: "Huge",
        components,
      }),
    ).rejects.toThrow(/exceeds size limits|invalid/i);
  });

  it("parses fragment formats and preserves subpath independence", () => {
    expect(parseFragment("#data=abc").data).toBe("abc");
    expect(parseFragment("#v=1&data=xyz").version).toBe("1");
    expect(parseFragment("#v=1&data=xyz").data).toBe("xyz");
  });
});
