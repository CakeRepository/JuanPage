export type RenderHandle = Readonly<{
  root: HTMLElement;
  destroy: () => void;
}>;

export type RuntimeTheme = "system" | "light" | "dark" | undefined;

/** Applies trusted host theme state. This module contains no document renderer. */
export function applyTheme(theme: RuntimeTheme): void {
  const root = globalThis.document.documentElement;
  if (!theme || theme === "system") {
    root.removeAttribute("data-theme");
    return;
  }
  root.setAttribute("data-theme", theme);
}
