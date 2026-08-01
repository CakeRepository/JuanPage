import { beforeEach, describe, expect, it } from "vitest";
import {
  appendMeaningSessionDelta,
  createMeaningSession,
  decodePagePayload,
  encodeMeaningSession,
} from "../src/encoding/pagePipeline";
import {
  buildInteractivePageShareUrl,
  interactionLedgerFromMeaningSession,
  interactionLedgerFromPage,
  pageWithSharedInteractionState,
} from "../src/encoding/shareableInteraction";
import { createScopeDelta, type MeaningPacket } from "../src/protocol/meaning";
import { validatePage } from "../src/schema/page";
import {
  loadPageState,
  pageStateKey,
  setPageInteractionState,
  setPageSelection,
  setPageValue,
} from "../src/state/pageState";

const page = validatePage({
  version: "2.0",
  title: "Shareable interaction state",
  objects: [{
    id: "task:one",
    type: "task",
    name: "Test the runtime",
    fields: [{ key: "done", value: false }],
  }],
  state: { selections: { tasks: [] } },
});

beforeEach(() => localStorage.clear());

describe("shareable interaction state", () => {
  it("encodes current values, semantic state, and a readable interaction ledger", async () => {
    const state = loadPageState(pageStateKey(page), page);
    setPageValue(state, "task:one", "done", true, "Complete the test task");
    setPageSelection(state, "tasks", ["task:one"], "Select the test task");
    setPageInteractionState(state, "groupings", "tasks", "done", "Group tasks by completion");

    const snapshot = pageWithSharedInteractionState(page, state);
    expect(snapshot.objects[0]?.fields?.[0]?.value).toBe(true);
    expect(snapshot.state?.selections?.tasks).toEqual(["task:one"]);
    expect(snapshot.state?.groupings?.tasks).toBe("done");
    expect(interactionLedgerFromPage(snapshot).map((entry) => entry.label)).toEqual([
      "Complete the test task",
      "Select the test task",
      "Group tasks by completion",
    ]);
    const ledgerObject = snapshot.objects.find((object) => object.id === "juanpager:activity");
    expect(ledgerObject?.name).toBe("Human activity");
    expect(ledgerObject?.fields).toHaveLength(3);

    const url = await buildInteractivePageShareUrl(page, state, "https://example.com/", "raw");
    const payload = new URL(url).hash.split("data=")[1] ?? "";
    const decoded = await decodePagePayload(payload, "raw");
    expect(decoded.kind).toBe("juanpage");
    if (decoded.kind === "juanpage") {
      expect(decoded.page.objects[0]?.fields?.[0]?.value).toBe(true);
      expect(decoded.page.state?.selections?.tasks).toEqual(["task:one"]);
      expect(interactionLedgerFromPage(decoded.page)).toHaveLength(3);
      expect(decoded.page.objects.some((object) => object.id === "juanpager:activity")).toBe(true);
    }
  });

  it("preserves an existing shared ledger while adding new local interactions", () => {
    const firstState = loadPageState(pageStateKey(page), page);
    setPageSelection(firstState, "tasks", ["task:one"], "Select the test task");
    const firstSnapshot = pageWithSharedInteractionState(page, firstState);

    const secondState = loadPageState(pageStateKey(firstSnapshot), firstSnapshot);
    setPageValue(secondState, "task:one", "done", true, "Complete the shared task");
    const secondSnapshot = pageWithSharedInteractionState(firstSnapshot, secondState);

    expect(interactionLedgerFromPage(secondSnapshot).map((entry) => entry.label)).toEqual([
      "Select the test task",
      "Complete the shared task",
    ]);
    expect(secondSnapshot.objects.filter((object) => object.id === "juanpager:activity")).toHaveLength(1);
  });

  it("reconstructs and renders readable human activity from an M1 URL session", async () => {
    const packet: MeaningPacket = [
      1,
      "pkt:share",
      0,
      null,
      [],
      [[0, [1, "Shareable session"], null, null, 0]],
    ];
    const session = appendMeaningSessionDelta(
      createMeaningSession(packet),
      createScopeDelta("pkt:share", 0, "period", "2026-07"),
    );

    expect(interactionLedgerFromMeaningSession(session).map((entry) => entry.label)).toEqual([
      "Scope period = 2026-07",
    ]);

    const decoded = await decodePagePayload(await encodeMeaningSession(session, "raw"), "raw");
    expect(decoded.kind).toBe("m1-session");
    if (decoded.kind === "m1-session") {
      const ledgerObject = decoded.page.objects.find((object) => object.id === "juanpager:activity");
      expect(ledgerObject?.fields?.[0]?.value).toContain("Scope period = 2026-07");
    }
  });
});
