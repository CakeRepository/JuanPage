import { describe, expect, it } from "vitest";
import { getAppBasePath, parseFragment } from "../src/encoding/fragment";

describe("GitHub Pages subpath handling", () => {
  it("keeps page data in the fragment, not query params", () => {
    const hash = "#v=1&data=abc123";
    const parsed = parseFragment(hash);
    expect(parsed.data).toBe("abc123");
    expect(parsed.version).toBe("1");
  });

  it("uses configured project subpath base", () => {
    window.JUANPAGER_CONFIG = { basePath: "/juanpager/" };
    expect(getAppBasePath()).toBe("/juanpager/");
    window.JUANPAGER_CONFIG = { basePath: "/custom-name" };
    expect(getAppBasePath()).toBe("/custom-name/");
  });
});
