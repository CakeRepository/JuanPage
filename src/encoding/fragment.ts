import type { PayloadEncoding } from "./pipeline.js";

export type FragmentParams = {
  version?: string;
  data?: string;
  encoding?: PayloadEncoding;
};

function parseEncoding(value: string | null): PayloadEncoding | undefined {
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

  // Also support a bare data=value form that URLSearchParams already handles.
  if (data || version) {
    return { data: data || undefined, version: version || undefined, encoding };
  }

  // Fallback: #ENCODED without key (not preferred, but avoid blank page if present)
  if (!raw.includes("=")) {
    return { data: raw };
  }

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

  // Vite injects import.meta.env.BASE_URL
  const viteBase = import.meta.env.BASE_URL || "/";
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
  return configured ?? "https://github.com/CakeRepository/juanpager#readme";
}
