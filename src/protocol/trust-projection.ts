import { materializeMeaningPacket, type RendererCapabilities } from "./meaning.js";
import { validatePage, type JuanPageDocument } from "../schema/page.js";

/**
 * Projects unsigned or otherwise unverified M1 as information only.
 * All executable actions and object action references are removed.
 */
export function materializeUntrustedMeaningPacket(
  input: unknown,
  capabilities?: RendererCapabilities,
): JuanPageDocument {
  const page = materializeMeaningPacket(input, capabilities);
  return validatePage({
    ...page,
    actions: [],
    objects: page.objects.map((object) => ({ ...object, actionIds: [] })),
    metadata: {
      ...(page.metadata ?? {}),
      "m1.trust": "untrusted",
      "m1.execution": "disabled",
    },
  });
}
