import { getAppBasePath } from "./encoding/fragment.js";

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let installPrompt: InstallPromptEvent | undefined;
let registered = false;

function publishInstallState(): void {
  window.dispatchEvent(new CustomEvent("juanpager:installability", {
    detail: { available: Boolean(installPrompt) },
  }));
}

export function registerJuanPagerPwa(): void {
  if (registered || typeof window === "undefined") return;
  registered = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    publishInstallState();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = undefined;
    publishInstallState();
  });
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      const base = getAppBasePath();
      void navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((error) => {
        console.error("JuanPager offline shell registration failed", error);
      });
    }, { once: true });
  }
}

export function juanPagerInstallAvailable(): boolean {
  return Boolean(installPrompt);
}

export async function promptJuanPagerInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const prompt = installPrompt;
  if (!prompt) return "unavailable";
  await prompt.prompt();
  const choice = await prompt.userChoice;
  if (choice.outcome === "accepted") installPrompt = undefined;
  publishInstallState();
  return choice.outcome;
}
