(() => {
  const fallbackUrl = "https://discord.flowdevs.io";
  const configuredUrl = window.JUANPAGER_CONFIG?.communityUrl;
  const candidate =
    typeof configuredUrl === "string" && configuredUrl.trim()
      ? configuredUrl.trim()
      : fallbackUrl;

  let communityUrl;
  try {
    communityUrl = new URL(candidate, window.location.href);
  } catch {
    return;
  }

  if (communityUrl.protocol !== "https:") return;

  for (const element of document.querySelectorAll("[data-community-link]")) {
    if (element instanceof HTMLAnchorElement) {
      element.href = communityUrl.toString();
    }
  }
})();
