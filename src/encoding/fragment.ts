import type { PagePayloadEncoding } from "./pagePipeline.js";

export type FragmentParams = {
  version?: string;
  data?: string;
  encoding?: PagePayloadEncoding;
  session?: string;
};

function parseEncoding(value: string | null): PagePayloadEncoding | undefined {
  if (value === "gz" || value === "raw") return value;
  return undefined;
}

export function parseFragment(hash: string): FragmentParams {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return {};

  const params = new URLSearchParams(raw);
  const data = params.get("data") ?? undefined;
  const version = params.get("v") ?? undefined;
  const encoding = parseEncoding(params.get("enc"));
  const session = params.get("session") ?? undefined;

  if (data || version || session) {
    return {
      data: data || undefined,
      version: version || undefined,
      encoding,
      session: session || undefined,
    };
  }

  if (!raw.includes("=")) return { data: raw };
  return {};
}

export function clearFragment(): void {
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", `${pathname}${search}`);
}

export function getAppBasePath(): string {
  const configured =
    typeof window !== "undefined"
      ? (window as Window & { JUANPAGER_CONFIG?: { basePath?: string } }).JUANPAGER_CONFIG
          ?.basePath
      : undefined;

  if (configured) return configured.endsWith("/") ? configured : `${configured}/`;

  const viteBase = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
  return viteBase.endsWith("/") ? viteBase : `${viteBase}/`;
}

export function builderPath(): string {
  return `${getAppBasePath()}builder.html`;
}

export function docsUrl(): string {
  const configured =
    typeof window !== "undefined"
      ? (window as Window & { JUANPAGER_CONFIG?: { docsUrl?: string } }).JUANPAGER_CONFIG
          ?.docsUrl
      : undefined;
  return configured ?? "https://github.com/CakeRepository/JuanPage#readme";
}
