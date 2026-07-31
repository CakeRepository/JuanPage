import type { MeaningPacket, RendererCapabilities } from "../protocol/meaning.js";
import { LensCapability, PermissionPolicy, materializeMeaningPacket } from "../protocol/meaning.js";

export const deploymentReferencePacket: MeaningPacket = [
  1,
  "pkt:deployment:reference",
  7,
  "vocab:en-US",
  [
    ["txt:title", "Software deployment approval"],
    ["txt:intent", "Review evidence and approve a controlled deployment"],
    ["type:deployment", "Deployment"],
    ["prop:package", "Package"],
    ["prop:ring", "Deployment ring"],
    ["prop:confidence", "Confidence"],
    ["rel:targets", "Targets"],
  ],
  [
    [0, [0, "txt:title"], [0, "txt:intent"], [1, "Deterministic offline reference application"], 0, 0, 0, 0],
    [1, "deployment:chrome-128", "type:deployment", [1, "Deploy Chrome 128"], [1, "Deployment"], [1, "Pending approval"], 2, [1, "Signed proposal for a staged browser update"], ["action:deploy", "action:wipe"], []],
    [1, "endpoint:ring-a", "type:endpoint", [1, "Ring A endpoints"], [1, "Targets"], [1, "12 healthy"], 1, [1, "Pilot group with rollback enabled"], [], []],
    [2, "deployment:chrome-128", "prop:package", "Google Chrome 128.0.6613.85", [0, "prop:package"], 0, 1, null],
    [2, "deployment:chrome-128", "prop:ring", "Ring A", [0, "prop:ring"], 0, 0, null],
    [2, "deployment:chrome-128", "prop:confidence", 0.94, [0, "prop:confidence"], 4, 1, null],
    [3, "deployment:chrome-128", "endpoint:ring-a", "rel:targets", [0, "rel:targets"]],
    [4, "action:deploy", 6, [1, "Approve deployment"], "deployment:chrome-128", null, ["deployment:chrome-128", "endpoint:ring-a"], 2, [1, "Creates an approval proposal before execution"], "op:software.deploy"],
    [4, "action:wipe", 6, [1, "Wipe endpoints"], "endpoint:ring-a", null, ["endpoint:ring-a"], 4, [1, "Destructive endpoint wipe is forbidden"], "op:endpoint.wipe"],
    [6, "signal:maintenance", "deployment:chrome-128", 0.72, [1, "Maintenance window closes in 30 minutes"], 0.98, [1, "scheduler:reference"]],
    [7, "evidence:health", "deployment:chrome-128", [1, "health-check:reference"], [1, "All pilot endpoints passed preflight"], 0.99],
    [7, "evidence:rollback", "deployment:chrome-128", [1, "rollback-plan:reference"], [1, "Previous package remains cached"], 0.96],
    [8, "action:deploy", PermissionPolicy.Approval, [1, "A human must approve software deployment"]],
    [8, "action:wipe", PermissionPolicy.Deny, [1, "Reference issuer is not authorized to wipe endpoints"]],
  ],
];

export const desktopCanvasCapabilities: RendererCapabilities = [1, "en-US", 3, LensCapability.Cards | LensCapability.Table | LensCapability.Flow, ["*"], 1440, 900, 0];
export const mobileDataCapabilities: RendererCapabilities = [1, "en-US", 9, LensCapability.Table, ["*"], 390, 844, 0];
export const flowCapabilities: RendererCapabilities = [1, "en-US", 3, LensCapability.Flow, ["*"], 1280, 800, 0];

export const deploymentReferenceViews = Object.freeze({
  desktopCanvas: materializeMeaningPacket(deploymentReferencePacket, desktopCanvasCapabilities),
  mobileData: materializeMeaningPacket(deploymentReferencePacket, mobileDataCapabilities),
  flow: materializeMeaningPacket(deploymentReferencePacket, flowCapabilities),
});
