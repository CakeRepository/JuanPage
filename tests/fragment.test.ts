import { describe, expect, it } from "vitest";
import { getAppBasePath, parseFragment } from "../src/encoding/fragment";

describe("GitHub Pages subpath handling", () => {
  it("keeps canonical v5 page data in the fragment, not query params", () => {
    const hash = "#v=5&enc=gz&data=abc123";
    const parsed = parseFragment(hash);
    expect(parsed.data).toBe("abc123");
    expect(parsed.version).toBe("5");
    expect(parsed.encoding).toBe("gz");
  });

  it("uses configured project subpath base", () => {
    window.JUANPAGER_CONFIG = { basePath: "/juanpager/" };
    expect(getAppBasePath()).toBe("/juanpager/");
    window.JUANPAGER_CONFIG = { basePath: "/custom-name" };
    expect(getAppBasePath()).toBe("/custom-name/");
  });
});
