import manifest from "./manifest.json";

export function updateBadge(tabId: number, count: number | undefined): void {
    const badgeText = count !== undefined ? count.toString() : "";
    const badgeColor = "#FF4444";

    chrome.action.setBadgeText({ text: badgeText, tabId });
    chrome.action.setBadgeBackgroundColor({ color: badgeColor, tabId });
}

export function updateIcon(tabId: number, state: "active" | "disabled"): void {
    const iconPaths =
        state === "active" ? manifest.icons : manifest.action?.default_icon;
    chrome.action.setIcon({ tabId, path: iconPaths });
}
