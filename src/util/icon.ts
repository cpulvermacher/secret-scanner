export function updateIcon(
    tabId: number,
    debuggerState: "active" | "inactive",
    count: number,
): void {
    if (count > 0 || debuggerState === "active") {
        const badgeText = count.toString();
        const badgeColor = count > 0 ? "#FF4444" : "#888888";

        chrome.action.setBadgeText({ text: badgeText, tabId });
        chrome.action.setBadgeBackgroundColor({ color: badgeColor, tabId });
    }
}
