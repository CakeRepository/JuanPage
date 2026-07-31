import { describe, expect, it } from "vitest";
import { decodePage, encodePage } from "../src/encoding/pagePipeline";
import { futureWorkspace } from "../src/examples/future-workspace";
import { DocumentValidationError } from "../src/schema/errors";
import { validatePage } from "../src/schema/page";

describe("JuanPage 1.0", () => {
  it("validates the universal demo", () => {
    expect(validatePage(futureWorkspace).objects).toHaveLength(8);
  });

  it("round trips through one v3 payload", async () => {
    const encoded = await encodePage(futureWorkspace);
    const decoded = await decodePage(encoded, "gz");
    expect(decoded).toEqual(futureWorkspace);
  });

  it("supports page-level human state in the universal contract", () => {
    const page = validatePage({
      ...futureWorkspace,
      actions: [
        ...(futureWorkspace.actions ?? []),
        {
          id: "page-mode",
          kind: "choice",
          label: "Operating mode",
          target: "page",
          field: "mode",
          options: [
            { label: "Explore", value: "explore" },
            { label: "Execute", value: "execute" },
          ],
        },
      ],
    });

    expect(page.actions?.at(-1)).toMatchObject({ target: "page", field: "mode" });
  });

  it("rejects relationships to unknown objects", () => {
    try {
      validatePage({
        ...futureWorkspace,
        relations: [{ from: "missing", to: "schema", kind: "breaks" }],
      });
      throw new Error("Expected validation to reject the unknown relationship");
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentValidationError);
      expect((error as DocumentValidationError).details).toMatch(/unknown object/i);
    }
  });
});
