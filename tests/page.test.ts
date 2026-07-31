import { describe, expect, it } from "vitest";
import { futureWorkspace } from "../src/examples/future-workspace";
import { decodePage, encodePage } from "../src/encoding/pagePipeline";
import { validatePage } from "../src/schema/page";

describe("JuanPage 1.0", () => {
  it("validates the universal demo", () => { expect(validatePage(futureWorkspace).objects).toHaveLength(8); });
  it("round trips through one v3 payload", async () => { const encoded = await encodePage(futureWorkspace); const decoded = await decodePage(encoded, "gz"); expect(decoded).toEqual(futureWorkspace); });
  it("rejects relationships to unknown objects", () => { expect(() => validatePage({ ...futureWorkspace, relations: [{ from: "missing", to: "schema", kind: "breaks" }] })).toThrow(/unknown object/i); });
});
