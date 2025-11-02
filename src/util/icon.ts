export function updateIcon(tabId: number, count: number): void {
    const badgeText = count > 0 ? count.toString() : "";
    const badgeColor = "#FF4444";

    chrome.action.setBadgeText({ text: badgeText, tabId });

    if (count > 0) {
        chrome.action.setBadgeBackgroundColor({ color: badgeColor, tabId });
    }
}
