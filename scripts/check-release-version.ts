import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
  name?: string;
  version?: string;
  publishConfig?: { provenance?: boolean; access?: string };
};

const failures: string[] = [];
const semanticVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
if (packageJson.name !== "juanpager") failures.push("Package name must remain juanpager.");
if (!packageJson.version || !semanticVersion.test(packageJson.version)) failures.push("package.json must contain a valid semantic version.");
if (packageJson.publishConfig?.access !== "public") failures.push("Published package access must be public.");
if (packageJson.publishConfig?.provenance !== true) failures.push("npm provenance must remain enabled.");

const tag = process.env.GITHUB_REF_TYPE === "tag"
  ? process.env.GITHUB_REF_NAME
  : process.env.GITHUB_REF?.startsWith("refs/tags/")
    ? process.env.GITHUB_REF.slice("refs/tags/".length)
    : undefined;
if (tag && packageJson.version && tag !== `v${packageJson.version}`) {
  failures.push(`Release tag ${tag} does not match package version v${packageJson.version}.`);
}

if (failures.length > 0) {
  console.error("Release identity check failed.\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Release identity verified for ${packageJson.name}@${packageJson.version}${tag ? ` from ${tag}` : ""}.`);
