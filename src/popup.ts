import type { SecretResult } from "./background";
import { getActiveTabId } from "./browser";
import { filterWithReason } from "./filter";
import { updateIcon } from "./icon";
import type { SecretType } from "./patterns";

// Get current tab and initialize UI
const currentTabId = await getActiveTabId();
let isScanning: boolean = false;
checkScanningStatus(currentTabId);
loadResults(currentTabId);

// UI elements
const statusIndicator = document.getElementById(
    "statusIndicator",
) as HTMLElement;
const statusText = document.getElementById("statusText") as HTMLElement;
const toggleButton = document.getElementById(
    "toggleButton",
) as HTMLButtonElement;
const resultsList = document.getElementById("resultsList") as HTMLElement;
const cautionText = document.getElementById("caution") as HTMLElement;

// Toggle scanning
toggleButton.addEventListener("click", (): void => {
    if (isScanning) {
        stopScanning(currentTabId);
    } else {
        startScanning(currentTabId);
    }
});

function startScanning(tabId: number): void {
    // Start scanning first, then reload to catch all network requests
    chrome.runtime.sendMessage(
        {
            action: "startScanning",
            tabId,
        },
        (response: { status: string }) => {
            if (response.status === "started") {
                isScanning = true;
                updateUI();
                updateIcon(tabId, "active");

                // Poll for results every 2 seconds
                pollForResults();

                chrome.tabs.reload(tabId);
            }
        },
    );
}

function stopScanning(tabId: number): void {
    chrome.runtime.sendMessage(
        {
            action: "stopScanning",
            tabId,
        },
        (response: { status: string }) => {
            if (response.status === "stopped") {
                isScanning = false;
                updateUI();
                updateIcon(tabId, "inactive");
            }
        },
    );
}

function checkScanningStatus(tabId: number): void {
    chrome.runtime.sendMessage(
        {
            action: "getStatus",
            tabId,
        },
        (response: { isScanning?: boolean }) => {
            isScanning = response?.isScanning || false;
            updateUI();
            updateIcon(tabId, isScanning ? "active" : "inactive");
        },
    );
}

function loadResults(tabId: number): void {
    chrome.runtime.sendMessage(
        {
            action: "getResults",
            tabId,
        },
        (response: { results?: SecretResult[] }) => {
            if (response?.results) {
                displayResults(response.results);
            }
        },
    );
}

function pollForResults(): void {
    if (isScanning) {
        loadResults(currentTabId);
        setTimeout(pollForResults, 1000);
    }
}

function updateUI(): void {
    toggleButton.disabled = false;
    if (isScanning) {
        statusIndicator.className = "status-indicator active";
        statusText.textContent = "Scanning page for secrets...";
        toggleButton.textContent = "Stop Scanning";
    } else {
        statusIndicator.className = "status-indicator inactive";
        statusText.textContent = "Ready to scan";
        toggleButton.textContent = "Reload & Scan Page";
    }
}

function displayResults(results: SecretResult[]): void {
    if (results.length === 0) {
        resultsList.innerHTML =
            '<div class="no-results">No secrets found</div>';
        cautionText.className = "invisible";

        return;
    }

    const maxMatchLength = 1000;
    resultsList.innerHTML = results
        .filter((secret) => filterWithReason(secret) === null)
        .map(
            (result: SecretResult) => `
    <div class="result-item">
      <div class="result-type">${escapeHtml(getTypeTitle(result.type))}</div>
      <div class="result-match">${escapeHtml(result.match.substring(0, maxMatchLength))}${result.match.length > maxMatchLength ? "..." : ""}</div>
      <div class="result-source">Source: ${formatSourceLink(result.source)}</div>
    </div>
  `,
        )
        .join("");

    // Add click listeners to source links
    const sourceLinks = resultsList.querySelectorAll(".source-link");
    sourceLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const url = (e.target as HTMLAnchorElement).href;
            if (url && isValidUrl(url)) {
                chrome.tabs.create({ url: `view-source:${url}` });
            }
        });
    });

    cautionText.className = "";
}

function escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function isValidUrl(string: string): boolean {
    try {
        new URL(string);
        return true;
    } catch {
        return false;
    }
}

function formatSourceLink(source: string): string {
    if (isValidUrl(source)) {
        return `<a class="source-link" href="${encodeURI(source)}">${escapeHtml(source)}</a>`;
    }
    return escapeHtml(source);
}

function getTypeTitle(type: SecretType): string {
    switch (type) {
        case "privateKey":
            return "Private Key";
        case "stripeAccessToken":
            return "Stripe Access Token";
        case "slackBotToken":
            return "Slack Bot Token";
        case "apiKey":
            return "API Key";
        case "password":
            return "Password";
    }
}
