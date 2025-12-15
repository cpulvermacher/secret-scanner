import type { SecretResult } from "./tabdata";
import type { Severity } from "../secrets/patterns";

function getHighestSeverity(results: SecretResult[]): Severity | null {
    if (results.length === 0) {
        return null;
    }

    // Check if any result has "high" severity
    const hasHigh = results.some((result) => result.severity === "high");
    return hasHigh ? "high" : "medium";
}

function getBadgeColor(severity: Severity | null): string {
    switch (severity) {
        case "high":
            return "#dc2626";
        case "medium":
            return "#ffa500";
        default:
            return "#808080";
    }
}

export function updateIcon(tabId: number, results: SecretResult[]): void {
    const count = results.length;
    const badgeText = count > 0 ? count.toString() : "";
    const badgeColor = getBadgeColor(getHighestSeverity(results));

    chrome.action.setBadgeText({ text: badgeText, tabId });

    if (count > 0) {
        chrome.action.setBadgeBackgroundColor({ color: badgeColor, tabId });
    }
}
