import { LIMITS } from "./limits.js";

export function isAllowedUrl(value: string, options?: { allowHttpLocal?: boolean }): boolean {
  if (typeof value !== "string" || value.length === 0 || value.length > LIMITS.maxUrlLength) {
    return false;
  }
  if (value.startsWith("//")) return false;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol === "https:") return true;

  const allowHttpLocal = options?.allowHttpLocal ?? isDevHost();
  if (allowHttpLocal && url.protocol === "http:") {
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  }

  return false;
}

export function isDevHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function assertSafeUrl(value: string, fieldName: string): string {
  if (!isAllowedUrl(value)) {
    throw new Error(`Unsafe or invalid URL in "${fieldName}"`);
  }
  return value;
}
