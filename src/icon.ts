import manifest from "./manifest.json";

export function updateIcon(
    tabId: number,
    state: "active" | "inactive",
    count?: number, // 0 to hide badge, undefined to not change
): void {
    const iconPaths =
        state === "active" ? manifest.icons : manifest.action?.default_icon;
    chrome.action.setIcon({ tabId, path: iconPaths });

    if (count !== undefined) {
        const badgeText = count !== 0 ? count.toString() : "";
        const badgeColor = "#FF4444";

        chrome.action.setBadgeText({ text: badgeText, tabId });
        chrome.action.setBadgeBackgroundColor({ color: badgeColor, tabId });
    }
}
