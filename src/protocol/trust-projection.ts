import { materializeMeaningPacket, type RendererCapabilities } from "./meaning.js";
import { validatePage, type JuanPageDocument } from "../schema/page.js";

/**
 * Projects unsigned or otherwise unverified M1 as information plus safe local
 * interaction. External invocation and navigation affordances are removed.
 */
export function materializeUntrustedMeaningPacket(
  input: unknown,
  capabilities?: RendererCapabilities,
): JuanPageDocument {
  const page = materializeMeaningPacket(input, capabilities);
  const affordances = (page.affordances ?? []).filter(
    (affordance) => affordance.effect.kind !== "invoke" && affordance.effect.kind !== "navigate",
  );
  const allowed = new Set(affordances.map((affordance) => affordance.id));
  return validatePage({
    ...page,
    affordances,
    bindings: page.bindings?.filter((binding) => allowed.has(binding.affordance)),
    metadata: {
      ...(page.metadata ?? {}),
      "m1.trust": "untrusted",
      "m1.execution": "disabled",
    },
  });
}
